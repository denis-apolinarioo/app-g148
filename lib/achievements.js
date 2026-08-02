// ============================================================================
// Verificação e desbloqueio de conquistas. Roda de forma "silenciosa" depois
// de ações do usuário (ex.: depois de submeter uma missão) — nunca trava a
// tela esperando essa checagem.
//
// Cada conquista usa um ID de documento determinístico (uid_conquistaId),
// o que faz o desbloqueio ser automaticamente à prova de duplicidade: tentar
// desbloquear a mesma conquista duas vezes é uma operação segura (idempotente).
// ============================================================================
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTodasAsConquistas } from './conquistasRepo';
import { contarAcoesCategoriaTotal } from './acoesLog';
import { vibrarConquista } from './haptics';

async function jaDesbloqueada(uid, achievementId) {
  const snap = await getDoc(doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`));
  return snap.exists();
}

async function desbloquear(uid, achievementId) {
  const jaTem = await jaDesbloqueada(uid, achievementId);
  if (jaTem) return false;
  await setDoc(doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`), {
    uid,
    achievementId,
    desbloqueadoEm: serverTimestamp(),
    // Controla se a pessoa já "abriu o cadeado" na aba de conquistas do
    // perfil. Começa false: a conquista aparece lá com mais contraste (já
    // desbloqueada) mas ainda com o cadeado por cima, esperando o toque que
    // dispara a animação de abertura.
    visto: false,
  });
  return true;
}

/**
 * Marca uma conquista como "vista" — chamada depois que a animação de
 * abertura do cadeado toca na aba de conquistas do perfil. Idempotente.
 */
export async function marcarConquistaVista(uid, achievementId) {
  await setDoc(
    doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`),
    { visto: true },
    { merge: true }
  );
}

async function contarSubmissoes(uid, missaoId) {
  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missaoId)
  );
  const snap = await getDocs(q);
  return snap.size;
}

async function contarPosts(uid) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Conquistas de Dracma — soma o campo `valor` de todas as entradas do
 * `dracmaLog` recebidas por `uid` cujo `tipo` esteja em `tiposValidos`.
 * Usado por `contadorTipo: 'dracma_ganho_total'` (total ganho na vida, sem
 * descontar o que já foi gasto/transferido depois).
 */
async function somarDracmaLog(uid, tiposValidos) {
  const q = query(
    collection(db, 'dracmaLog'),
    where('destino', '==', uid),
    where('tipo', 'in', tiposValidos)
  );
  const snap = await getDocs(q);
  return snap.docs.reduce((total, d) => total + (d.data().valor || 0), 0);
}

/**
 * Conquistas de Dracma — conta quantas transferências `uid` enviou
 * (direcao 'enviada') ou recebeu (direcao 'recebida'). Usado por
 * `contadorTipo: 'dracma_enviado:qtd'` e `'dracma_recebido:qtd'`.
 */
async function contarTransferencias(uid, direcao) {
  const campo = direcao === 'enviada' ? 'origem' : 'destino';
  const q = query(
    collection(db, 'dracmaLog'),
    where(campo, '==', uid),
    where('tipo', '==', 'transferencia')
  );
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Diz se o contadorTipo de uma conquista é relevante para checar agora,
 * dado o contexto da ação que acabou de acontecer. Streak é sempre checado
 * (pode avançar em qualquer ação), os demais só quando o contexto bate.
 *
 * FASE 2 — contadorTipo 'categoria:<id>' conta uma categoria de ação
 * configurável (lib/categoriasAcaoRepo.js / lib/acoesLog.js). Como a Fase 3
 * usa isso pra categoria de post, é relevante checar no mesmo contexto
 * 'post' — sem precisar de um contexto novo pra cada categoria criada.
 */
function contadorRelevantePara(contadorTipo, contexto) {
  if (contadorTipo === 'streak') return true;
  // Saldo de Dracma pode ter mudado nos três contextos abaixo — sempre
  // relevante checar de novo, igual ao streak.
  if (contadorTipo === 'dracma_saldo') {
    return contexto === 'dracma_ganho' || contexto === 'dracma_enviado' || contexto === 'dracma_recebido';
  }
  if (contexto === 'missao_diaria' || contexto === 'leitura') {
    return contadorTipo.startsWith('missao:');
  }
  if (contexto === 'oracao') return contadorTipo === 'oracao';
  if (contexto === 'post') return contadorTipo === 'post' || contadorTipo.startsWith('categoria:');
  if (contexto === 'dracma_ganho') return contadorTipo === 'dracma_ganho_total';
  if (contexto === 'dracma_enviado') return contadorTipo === 'dracma_enviado:qtd';
  if (contexto === 'dracma_recebido') return contadorTipo === 'dracma_recebido:qtd';
  return false;
}

/**
 * Calcula o valor atual do contador de uma conquista, de acordo com seu
 * contadorTipo.
 */
async function calcularContador(contadorTipo, uid, streakAtual, dracmaSaldoAtual = null) {
  if (contadorTipo === 'streak') {
    return streakAtual;
  }
  if (contadorTipo === 'dracma_saldo') {
    return dracmaSaldoAtual ?? 0;
  }
  if (contadorTipo === 'dracma_ganho_total') {
    return somarDracmaLog(uid, ['ganho_missao', 'ganho_manual']);
  }
  if (contadorTipo === 'dracma_enviado:qtd') {
    return contarTransferencias(uid, 'enviada');
  }
  if (contadorTipo === 'dracma_recebido:qtd') {
    return contarTransferencias(uid, 'recebida');
  }
  if (contadorTipo.startsWith('missao:')) {
    const missaoId = contadorTipo.slice('missao:'.length);
    return contarSubmissoes(uid, missaoId);
  }
  // FASE 2 — conta quantas vezes a pessoa fez uma categoria de ação
  // configurável (ex.: quantas vezes postou usando a categoria "Oração").
  if (contadorTipo.startsWith('categoria:')) {
    const categoriaId = contadorTipo.slice('categoria:'.length);
    return contarAcoesCategoriaTotal(uid, categoriaId);
  }
  if (contadorTipo === 'oracao') {
    const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
    const snap = await getDocs(q);
    return snap.size;
  }
  if (contadorTipo === 'post') {
    return contarPosts(uid);
  }
  return 0;
}

/**
 * Roda as checagens de conquista relevantes para o contexto informado.
 * `contexto` pode ser: 'missao_diaria', 'oracao', 'post', 'leitura'.
 * Retorna a lista de conquistas recém-desbloqueadas nesta chamada (para
 * eventualmente mostrar um aviso festivo na tela).
 *
 * Genérico sobre o catálogo de conquistas (vindo do Firestore, ver
 * lib/conquistasRepo.js) — cada conquista automática (contadorTipo !==
 * 'manual') é checada usando seu próprio contadorTipo/meta, em vez de um
 * bloco de if escrito à mão por conquista. Isso permite chegar a dezenas de
 * conquistas sem essa função crescer proporcionalmente, e o Admin cria
 * conquista nova (inclusive baseada numa categoria da Fase 2) sem precisar
 * de mudança de código.
 *
 * Retorna a lista das conquistas (objeto completo, não só o id) desbloqueadas
 * nesta chamada — quem usa (ex.: MissionSubmitModal) já tem nome/descrição/
 * imagem prontos pra mostrar a tela de "Nova conquista!", sem precisar de
 * outra leitura.
 */
export async function verificarConquistas(uid, streakAtual, contexto, dracmaSaldoAtual = null) {
  const novas = [];

  const catalogo = await getTodasAsConquistas();
  const candidatas = catalogo.filter((c) => c.ativa !== false && c.contadorTipo !== 'manual');

  for (const conquista of candidatas) {
    if (!contadorRelevantePara(conquista.contadorTipo, contexto)) continue;

    // eslint-disable-next-line no-await-in-loop
    const jaTem = await jaDesbloqueada(uid, conquista.id);
    if (jaTem) continue;

    // eslint-disable-next-line no-await-in-loop
    const valorAtual = await calcularContador(conquista.contadorTipo, uid, streakAtual, dracmaSaldoAtual);
    if (valorAtual >= conquista.meta) {
      // eslint-disable-next-line no-await-in-loop
      if (await desbloquear(uid, conquista.id)) novas.push(conquista);
    }
  }

  if (novas.length > 0) vibrarConquista();

  return novas;
}

/**
 * Retorna TODAS as conquistas (bloqueadas e desbloqueadas), cada uma com
 * `desbloqueada` e `visto` mesclados. Usado na aba de conquistas do perfil,
 * que agora mostra o catálogo inteiro (com cadeado nas que faltam) em vez de
 * só as já conquistadas.
 */
export async function getConquistasDoUsuario(uid) {
  const [catalogo, snap] = await Promise.all([
    getTodasAsConquistas(),
    getDocs(query(collection(db, 'achievementsUnlocked'), where('uid', '==', uid))),
  ]);
  const porId = {};
  snap.docs.forEach((d) => {
    const dados = d.data();
    porId[dados.achievementId] = dados;
  });

  return catalogo.filter((c) => c.ativa !== false).map((c) => {
    const registro = porId[c.id];
    return {
      ...c,
      desbloqueada: !!registro,
      // Documentos antigos (de antes dessa função existir) não têm o campo
      // `visto` — tratamos como já visto, pra não fazer conquistas antigas
      // aparecerem de repente pedindo pra serem "abertas" de novo.
      visto: registro ? registro.visto !== false : true,
    };
  });
}

/**
 * Escolhe até 3 conquistas pra "vitrine" (destaque) do topo do perfil.
 *
 * `usuario.vitrineConquistas` é uma lista de IDs, salva pela própria pessoa
 * em ordem de preferência (ver VitrineConquistasModal). Se ela nunca
 * escolheu nada ainda, cai num padrão automático: as 3 primeiras conquistas
 * desbloqueadas, na ordem do catálogo (coleção "conquistas" no Firestore,
 * ver lib/conquistasRepo.js) — assim o perfil não fica com a vitrine vazia
 * à toa.
 *
 * IDs escolhidos que não estão mais desbloqueados (não deveria acontecer,
 * já que conquista nunca é perdida, mas por segurança) são ignorados.
 */
export function getVitrineConquistas(usuario, conquistas) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);
  const escolhidas = Array.isArray(usuario?.vitrineConquistas) ? usuario.vitrineConquistas : [];

  if (escolhidas.length === 0) return desbloqueadas.slice(0, 3);

  const porId = {};
  desbloqueadas.forEach((c) => {
    porId[c.id] = c;
  });
  return escolhidas.map((id) => porId[id]).filter(Boolean).slice(0, 3);
}
