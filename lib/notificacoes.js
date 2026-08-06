// ============================================================================
// NOTIFICAÇÕES DE SISTEMA — missão nova/especial, ganho de pontos e dracma
// pelo Admin, e resgate de recompensa anexada no Correio.
// ----------------------------------------------------------------------------
// (A notificação de conquista desbloqueada mora em lib/achievements.js, não
// aqui — colocá-la lá evita import circular, já que resgatarRecompensaCorreio
// abaixo precisa chamar verificarConquistas depois de creditar Dracma.)
//
// Fica separado de firestore-helpers.js de propósito, igual points.js e
// push.js: é uma área nova o bastante pra merecer arquivo próprio. Toda
// função aqui cria um documento em `mailbox` (mesma coleção do Correio) —
// como a Cloud Function `enviarPushMailbox` (functions/index.js) já dispara
// push pra QUALQUER documento novo em `mailbox`, essas notificações ganham
// push automaticamente, sem precisar mexer na função pra cada caso.
//
// Cada função aqui SÓ cria o aviso — nunca falha a ação principal por causa
// disso (erro vai pro console, não sobe pra quem chamou), igual o padrão já
// usado em `notificarInteracao` (lib/firestore-helpers.js).
// ============================================================================
import {
  collection,
  doc,
  getDoc,
  addDoc,
  writeBatch,
  serverTimestamp,
  runTransaction,
  increment,
} from 'firebase/firestore';
import { db } from './firebase';
import { verificarConquistas } from './achievements';
import { formatarDracma } from './dracma';

/**
 * Chamada de AbaUsuarios.js logo depois de um ajuste manual de Pontos de
 * Comunhão pelo Admin. Só GANHOS (valor > 0) notificam — um desconto/
 * correção do Admin não precisa virar aviso, pra não parecer uma punição
 * pública nem gerar ruído.
 */
export async function notificarGanhoPontos(uid, admin, valor) {
  if (!uid || !admin?.uid || !(valor > 0)) return;
  try {
    await addDoc(collection(db, 'mailbox'), {
      remetenteId: admin.uid,
      destinatarioId: uid,
      tipo: 'pontos_admin',
      texto: `Você recebeu ${valor} Pontos de Comunhão!`,
      valor,
      fixada: false,
      lida: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao criar notificação de ganho de pontos:', err);
  }
}

/** Mesma ideia de notificarGanhoPontos, só que para Dracma. */
export async function notificarGanhoDracma(uid, admin, valor) {
  if (!uid || !admin?.uid || !(valor > 0)) return;
  try {
    await addDoc(collection(db, 'mailbox'), {
      remetenteId: admin.uid,
      destinatarioId: uid,
      tipo: 'dracma_admin',
      texto: `Você recebeu ${formatarDracma(valor)} Dracmas!`,
      valor,
      fixada: false,
      lida: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao criar notificação de ganho de Dracma:', err);
  }
}

/**
 * Chamada de AbaMissoes.js quando o Admin cria (ou marca pra notificar) uma
 * missão ativa. Usa a categoria já existente da missão pra decidir o tipo:
 * 'exclusiva' vira aviso de "missão especial", 'geral' vira "missão nova".
 * Respeita `missao.destinatarios` (se a missão já é só pra gente específica,
 * só essas pessoas recebem o aviso — não faz sentido avisar todo mundo de
 * uma missão que a maioria nem vai poder ver). Sem destinatarios definidos,
 * notifica todo mundo (exceto quem está travado — mesmo critério usado no
 * resto do app pra criação de notificação).
 */
export async function notificarNovaMissao(missao, admin, todosUsuarios) {
  if (!missao?.id || !admin?.uid) return;
  try {
    const idsAlvo =
      Array.isArray(missao.destinatarios) && missao.destinatarios.length > 0
        ? missao.destinatarios
        : (todosUsuarios || []).filter((u) => !u.travado).map((u) => u.id);

    const destinatarios = idsAlvo.filter((uid) => uid && uid !== admin.uid);
    if (destinatarios.length === 0) return;

    const tipo = missao.categoria === 'exclusiva' ? 'missao_especial' : 'missao_nova';
    const texto =
      tipo === 'missao_especial'
        ? `Nova missão exclusiva disponível: "${missao.titulo}"`
        : `Nova missão disponível: "${missao.titulo}"`;

    // Mesmo padrão de sendMailToMultiple (lib/firestore-helpers.js) — um
    // writeBatch em vez de N chamadas individuais, em lotes de até 450
    // (limite do Firestore é 500 operações por lote).
    const TAMANHO_LOTE = 450;
    for (let i = 0; i < destinatarios.length; i += TAMANHO_LOTE) {
      const lote = destinatarios.slice(i, i + TAMANHO_LOTE);
      const batch = writeBatch(db);
      lote.forEach((destinatarioId) => {
        const ref = doc(collection(db, 'mailbox'));
        batch.set(ref, {
          remetenteId: admin.uid,
          destinatarioId,
          tipo,
          texto,
          missaoId: missao.id,
          fixada: false,
          lida: false,
          createdAt: serverTimestamp(),
        });
      });
      // eslint-disable-next-line no-await-in-loop
      await batch.commit();
    }
  } catch (err) {
    console.error('Erro ao notificar nova missão:', err);
  }
}

/**
 * Item novo — "enviar pontos e dracmas pelo Correio". Resgata a recompensa
 * anexada a UMA mensagem (ver AbaCorreio.js, que grava `pontosAnexados` e/ou
 * `dracmasAnexados` + `resgatado: false` ao enviar). Só quem recebeu pode
 * resgatar, e só uma vez — tudo dentro de uma ÚNICA transação do Firestore
 * (mensagem + saldo do usuário + registro no extrato), pra não existir
 * cenário de "marcou como resgatado mas não creditou" por queda de conexão
 * no meio do caminho.
 *
 * Lança um erro com uma destas mensagens se não puder resgatar:
 * 'MENSAGEM_NAO_ENCONTRADA' | 'SEM_PERMISSAO' | 'JA_RESGATADO' | 'SEM_RECOMPENSA'
 */
export async function resgatarRecompensaCorreio(mensagemId, uid) {
  const msgRef = doc(db, 'mailbox', mensagemId);
  const userRef = doc(db, 'users', uid);
  const pointsLogRef = doc(collection(db, 'pointsLog'));
  const dracmaLogRef = doc(collection(db, 'dracmaLog'));

  let pontos = 0;
  let dracmas = 0;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(msgRef);
    if (!snap.exists()) throw new Error('MENSAGEM_NAO_ENCONTRADA');
    const dados = snap.data();
    if (dados.destinatarioId !== uid) throw new Error('SEM_PERMISSAO');
    if (dados.resgatado) throw new Error('JA_RESGATADO');

    pontos = Number(dados.pontosAnexados) || 0;
    dracmas = Number(dados.dracmasAnexados) || 0;
    if (pontos <= 0 && dracmas <= 0) throw new Error('SEM_RECOMPENSA');

    transaction.update(msgRef, { resgatado: true, resgatadoEm: serverTimestamp() });

    const incrementos = {};
    if (pontos > 0) {
      incrementos.pontos = increment(pontos);
      transaction.set(pointsLogRef, {
        uid,
        tipo: 'correio',
        valor: pontos,
        descricao: 'Recompensa recebida no Correio',
        referenciaId: mensagemId,
        createdAt: serverTimestamp(),
      });
    }
    if (dracmas > 0) {
      incrementos.dracmas = increment(dracmas);
      transaction.set(dracmaLogRef, {
        uid,
        tipo: 'correio',
        valor: dracmas,
        descricao: 'Recompensa recebida no Correio',
        referenciaId: mensagemId,
        createdAt: serverTimestamp(),
      });
    }
    transaction.update(userRef, incrementos);
  });

  // Fora da transação: checagem de conquistas de Dracma (mesmo padrão de
  // creditarDracma em lib/dracma.js) — não precisa ser atômico com o
  // crédito em si, e não deve travar o resgate se falhar.
  if (dracmas > 0) {
    try {
      const snapUser = await getDoc(userRef);
      await verificarConquistas(uid, 0, 'dracma_ganho', snapUser.data()?.dracmas || 0);
    } catch (err) {
      console.error('Erro ao checar conquistas de Dracma (resgate no Correio):', err);
    }
  }

  return { pontos, dracmas };
}
