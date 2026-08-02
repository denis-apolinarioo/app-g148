// ============================================================================
// PACOTE 2 — Carteira de Dracma.
// ----------------------------------------------------------------------------
// Espelha o espírito de lib/points.js (transações atômicas + log auditável),
// mas para a moeda Dracma. O campo `dracmas` no documento de users/{uid} e o
// crédito automático por missão/ação (submeterMissao, pontuarPostFeed,
// pontuarOracao) já são responsabilidade do Pacote 1 (lib/points.js).
//
// IMPORTANTE PRA QUEM FOR RECONCILIAR COM O PACOTE 1: `creditarDracma()`
// abaixo é a função "canônica" de crédito de Dracma (transação + gravação em
// `dracmaLog`, mesmo padrão de `awardPoints()` em lib/points.js). Se
// lib/points.js tiver escrito a própria lógica de incremento de `dracmas`
// direto (sem passar por aqui), o ideal é trocar aquela chamada por
// `creditarDracma()` pra que TODO crédito de Dracma (por missão, ação ou
// ajuste do admin) caia no mesmo `dracmaLog` — é o que alimenta o histórico
// de transações da tela Carteira. Não é obrigatório pra este pacote
// funcionar (a Carteira lê `dracmaLog` normalmente mesmo que só os ajustes
// do admin apareçam nela por enquanto), só evita duplicar lógica depois.
//
// Coleção `dracmaLog` (mesmo formato de `pointsLog`):
//   uid, tipo ('missao'|'oracao'|'post'|'ajuste_admin'|...), valor,
//   descricao, referenciaId, createdAt
// ============================================================================
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit as fbLimit,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAcaoAdmin } from './adminLog';
import { getAllUsers } from './firestore-helpers';
import { CHAVE_TRANSFERENCIA_DRACMA_ATIVA, getConfiguracoesApp } from './appConfig';

// ----------------------------------------------------------------------------
// CRÉDITO / DÉBITO (transacional, com log)
// ----------------------------------------------------------------------------

/**
 * Credita (ou debita, se `valor` for negativo) Dracma de forma atômica e
 * registra a transação em `dracmaLog`. Uso interno de outras funções deste
 * arquivo — normalmente você não chama isso direto, exceto se for integrar
 * o crédito automático do Pacote 1 a este mesmo histórico (ver comentário
 * no topo do arquivo).
 */
export async function creditarDracma(uid, valor, tipo, descricao, referenciaId = null) {
  const userRef = doc(db, 'users', uid);
  const logRef = doc(collection(db, 'dracmaLog'));
  await runTransaction(db, async (transaction) => {
    transaction.update(userRef, { dracmas: increment(valor) });
    transaction.set(logRef, {
      uid,
      tipo,
      valor,
      descricao,
      referenciaId,
      createdAt: serverTimestamp(),
    });
  });
}

/**
 * Ajuste manual de Dracma feito pelo Admin (equivalente a
 * `ajustarPontosManualmente` em lib/points.js, usado hoje em
 * AbaUsuarios.js). `valor` pode ser positivo (soma) ou negativo (remove).
 *
 * Diferente do ajuste de pontos (que só grava em `adminActionsLog`), este
 * TAMBÉM grava em `dracmaLog` — é dinheiro entrando/saindo da carteira de
 * alguém, então faz sentido a pessoa ver esse ajuste no próprio histórico
 * de transações, além do Admin ver no histórico de auditoria.
 */
export async function ajustarDracmaManualmente(uid, valor, admin, motivo = '') {
  const userRef = doc(db, 'users', uid);
  let dracmasAntes = 0;
  let dracmasDepois = 0;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    dracmasAntes = snap.data()?.dracmas || 0;
    dracmasDepois = dracmasAntes + valor;
    transaction.update(userRef, { dracmas: increment(valor) });
    transaction.set(doc(collection(db, 'dracmaLog')), {
      uid,
      tipo: 'ajuste_admin',
      valor,
      descricao: motivo?.trim() ? `Ajuste manual: ${motivo.trim()}` : 'Ajuste manual do administrador',
      referenciaId: admin?.uid || null,
      createdAt: serverTimestamp(),
    });
  });

  await registrarAcaoAdmin({
    admin,
    acao: 'ajustar_dracma',
    alvoTipo: 'users',
    alvoId: uid,
    valorAntes: dracmasAntes,
    valorDepois: dracmasDepois,
    detalhes: motivo,
  });

  return dracmasDepois;
}

/**
 * Histórico de transações de Dracma de UM usuário, em tempo real — usado
 * pela tela Carteira. Combina 3 escutas (mesmo motivo de
 * `buscarAcoesAdminPorUsuario` em lib/adminLog.js: consulta de um campo só
 * não exige índice composto no Firestore):
 *   - `uid` == pessoa: ganhos por missão/oração/post/ajuste do admin
 *   - `origem` == pessoa: transferências ENVIADAS (PACOTE 3)
 *   - `destino` == pessoa: transferências RECEBIDAS (PACOTE 3)
 * A ordenação (mais recente primeiro) é feita no cliente, juntando as três.
 */
export function subscribeToDracmaLog(uid, callback, quantidade = 50) {
  const partes = { proprio: [], enviadas: [], recebidas: [] };

  function emitir() {
    const todos = [...partes.proprio, ...partes.enviadas, ...partes.recebidas];
    todos.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
    callback(todos.slice(0, quantidade));
  }

  function escutar(campo, chaveResultado) {
    const q = query(collection(db, 'dracmaLog'), where(campo, '==', uid), fbLimit(quantidade));
    return onSnapshot(
      q,
      (snap) => {
        partes[chaveResultado] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        emitir();
      },
      (err) => {
        console.error(`[subscribeToDracmaLog] Erro na escuta (${campo}):`, err);
        partes[chaveResultado] = [];
        emitir();
      }
    );
  }

  const unsub1 = escutar('uid', 'proprio');
  const unsub2 = escutar('origem', 'enviadas');
  const unsub3 = escutar('destino', 'recebidas');

  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
}

// ----------------------------------------------------------------------------
// PACOTE 3 — TRANSFERÊNCIA ENTRE USUÁRIOS
// ----------------------------------------------------------------------------
// A "chave de recebimento" de uma pessoa é o próprio @username + a data de
// nascimento cadastrada no onboarding, tudo junto e separado por "_" (ex.:
// username "joao" + nascimento "1990-05-20" -> "joao_1990_05_20"). Não é
// salva em nenhum campo novo no Firestore — é calculada na hora, tanto pra
// EXIBIR a chave de cada um (Carteira) quanto pra ACHAR o destinatário a
// partir da chave digitada (busca entre os usuários já carregados por
// getAllUsers(), leitura já liberada pra qualquer pessoa logada).
// ----------------------------------------------------------------------------

export function montarChaveRecebimento(perfil) {
  if (!perfil?.username || !perfil?.dataNascimento) return '';
  return `${perfil.username}_${perfil.dataNascimento.replaceAll('-', '_')}`;
}

/**
 * Acha o usuário dono de uma chave de recebimento. Retorna `null` se não
 * achar ninguém (chave digitada errada) — a tela mostra a mensagem de erro
 * apropriada.
 */
export async function buscarUsuarioPorChaveRecebimento(chave) {
  const chaveNormalizada = (chave || '').trim().toLowerCase();
  if (!chaveNormalizada) return null;
  const usuarios = await getAllUsers();
  return usuarios.find((u) => montarChaveRecebimento(u).toLowerCase() === chaveNormalizada) || null;
}

/**
 * Transfere Dracma de `origem` (perfil de quem está logado) pra quem tiver
 * a `chaveDestino` informada. Exige PIN correto (mesma trava de
 * MAX_TENTATIVAS/bloqueio de validarPin) e que o toggle de transferências
 * (Admin → Config) esteja ligado. Atômica (runTransaction) e grava UMA
 * entrada em `dracmaLog` com `tipo: 'transferencia'` — o mesmo formato
 * (origem/destino/valor) que lib/achievements.js já espera pras conquistas
 * de Dracma (Generosidade / Mão Que Recebe).
 *
 * Lança, além dos erros de validarPin ('PIN_NAO_CONFIGURADO',
 * 'PIN_BLOQUEADO', 'PIN_INCORRETO'):
 * - 'TRANSFERENCIAS_DESATIVADAS' se o Admin desligou a função;
 * - 'VALOR_INVALIDO' se o valor não for um número inteiro positivo;
 * - 'DESTINO_NAO_ENCONTRADO' se a chave não corresponder a ninguém;
 * - 'DESTINO_INVALIDO' se a pessoa tentar enviar pra si mesma;
 * - 'SALDO_INSUFICIENTE' se não tiver Dracma suficiente no momento da
 *   transação (checado dentro da transação, contra tentativa de gastar o
 *   mesmo saldo duas vezes em paralelo).
 */
export async function transferirDracma(origem, chaveDestino, valor, pin, descricao = '') {
  const config = await getConfiguracoesApp();
  if (config[CHAVE_TRANSFERENCIA_DRACMA_ATIVA] === false) {
    throw new Error('TRANSFERENCIAS_DESATIVADAS');
  }

  const valorNumerico = Math.trunc(Number(valor));
  if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) {
    throw new Error('VALOR_INVALIDO');
  }

  await validarPin(origem.uid, pin);

  const destino = await buscarUsuarioPorChaveRecebimento(chaveDestino);
  if (!destino) throw new Error('DESTINO_NAO_ENCONTRADO');
  if (destino.id === origem.uid) throw new Error('DESTINO_INVALIDO');

  const origemRef = doc(db, 'users', origem.uid);
  const destinoRef = doc(db, 'users', destino.id);
  const logRef = doc(collection(db, 'dracmaLog'));

  await runTransaction(db, async (transaction) => {
    const origemSnap = await transaction.get(origemRef);
    const saldoAtual = origemSnap.data()?.dracmas || 0;
    if (saldoAtual < valorNumerico) throw new Error('SALDO_INSUFICIENTE');

    transaction.update(origemRef, { dracmas: increment(-valorNumerico) });
    transaction.update(destinoRef, { dracmas: increment(valorNumerico) });
    transaction.set(logRef, {
      tipo: 'transferencia',
      origem: origem.uid,
      destino: destino.id,
      valor: valorNumerico,
      descricao: (descricao || '').trim(),
      createdAt: serverTimestamp(),
    });
  });

  return destino;
}

// ----------------------------------------------------------------------------
// PACOTE 3, item 3.2 — histórico de Dracma pro painel Admin (aba Histórico).
// ----------------------------------------------------------------------------

/**
 * Todas as entradas de `dracmaLog` (qualquer pessoa), mais recentes
 * primeiro — usado pela sub-aba "Dracma" da aba Histórico do Admin. Usa
 * orderBy direto (sem where) porque não filtra por campo nenhum, então não
 * exige índice composto.
 */
export function subscribeToDracmaLogTodos(callback, quantidade = 30) {
  const q = query(collection(db, 'dracmaLog'), orderBy('createdAt', 'desc'), fbLimit(quantidade));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => {
      console.error('[subscribeToDracmaLogTodos] Erro na escuta em tempo real:', err);
      callback([]);
    }
  );
}

/**
 * Entradas de `dracmaLog` de UMA pessoa (como `uid` de ganho/ajuste OU como
 * `origem`/`destino` de uma transferência) — usado pela sub-aba "Dracma" do
 * Histórico do Admin ao filtrar por usuário.
 */
export async function buscarDracmaLogPorUsuario(uid) {
  const [porUid, porOrigem, porDestino] = await Promise.all([
    getDocs(query(collection(db, 'dracmaLog'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'dracmaLog'), where('origem', '==', uid))),
    getDocs(query(collection(db, 'dracmaLog'), where('destino', '==', uid))),
  ]);
  const registros = [...porUid.docs, ...porOrigem.docs, ...porDestino.docs].map((d) => ({
    id: d.id,
    ...d.data(),
  }));
  registros.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  return registros;
}

// ----------------------------------------------------------------------------
// PACOTE 3, item 3.3 — reset manual de Dracma de TODOS os usuários.
// ----------------------------------------------------------------------------

/**
 * Zera o campo `dracmas` de todos os usuários do app (writeBatch em lotes de
 * 450, pra ficar bem abaixo do limite de 500 operações por lote do
 * Firestore). Registra UMA entrada em `adminActionsLog` resumindo quantas
 * pessoas foram afetadas — não grava em `dracmaLog` pra não gerar centenas
 * de entradas de "zeramento" no histórico pessoal de cada um.
 */
export async function resetarDracmasDeTodos(admin) {
  const usuarios = await getAllUsers();
  const afetados = usuarios.filter((u) => (u.dracmas || 0) !== 0);

  for (let i = 0; i < afetados.length; i += 450) {
    const lote = afetados.slice(i, i + 450);
    const batch = writeBatch(db);
    lote.forEach((u) => batch.update(doc(db, 'users', u.id), { dracmas: 0 }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  await registrarAcaoAdmin({
    admin,
    acao: 'resetar_dracmas_todos',
    alvoTipo: 'users',
    alvoId: '',
    valorAntes: null,
    valorDepois: 0,
    detalhes: `${afetados.length} usuário(s) tiveram o saldo de Dracma zerado.`,
  });

  return afetados.length;
}

// ----------------------------------------------------------------------------
// PIN de 4 dígitos (hash + salt, nunca gravado em texto puro)
// ----------------------------------------------------------------------------

export const PIN_MAX_TENTATIVAS = 5;
export const PIN_BLOQUEIO_MINUTOS = 15;
const RECUPERACAO_EXPIRA_MINUTOS = 10;

function bytesParaHex(bytes) {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function gerarSaltHex() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return bytesParaHex(bytes);
}

/**
 * Hash de um PIN (ou código de recuperação) com o salt informado, via
 * Web Crypto (SubtleCrypto — disponível no navegador, não precisa de
 * dependência nova). Nunca compare PINs em texto puro: sempre gere o hash
 * com o mesmo salt e compare os hashes.
 */
async function hashComSalt(valor, salt) {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(`${salt}:${valor}`));
  return bytesParaHex(buffer);
}

export function pinConfigurado(perfil) {
  return !!perfil?.pinHash;
}

/**
 * Quantos minutos faltam pro bloqueio por tentativas erradas acabar.
 * Retorna 0 se não está bloqueado.
 */
export function minutosRestantesBloqueio(perfil) {
  const ate = perfil?.pinBloqueadoAte?.toMillis?.();
  if (!ate) return 0;
  const restanteMs = ate - Date.now();
  return restanteMs > 0 ? Math.ceil(restanteMs / 60000) : 0;
}

/**
 * Cria (ou substitui, no fluxo de "esqueci meu PIN") o PIN de 4 dígitos do
 * próprio usuário. Zera tentativas/bloqueio, já que é um PIN novo.
 */
export async function configurarPin(uid, pin) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN_INVALIDO');

  const salt = gerarSaltHex();
  const hash = await hashComSalt(pin, salt);

  await updateDoc(doc(db, 'users', uid), {
    pinHash: hash,
    pinSalt: salt,
    pinTentativasFalhas: 0,
    pinBloqueadoAte: null,
  });
}

/**
 * Valida o PIN digitado contra o hash salvo. Lança:
 * - 'PIN_NAO_CONFIGURADO' se o usuário ainda não criou um PIN;
 * - 'PIN_BLOQUEADO' se passou de PIN_MAX_TENTATIVAS erradas nos últimos
 *   PIN_BLOQUEIO_MINUTOS minutos;
 * - 'PIN_INCORRETO' se o PIN não bateu (tentativa já foi contabilizada).
 * Retorna `true` se o PIN estiver correto (e zera o contador de tentativas).
 */
export async function validarPin(uid, pin) {
  const userRef = doc(db, 'users', uid);
  const snapAtual = await getDoc(userRef);
  const dadosAtuais = snapAtual.data();
  if (!dadosAtuais?.pinHash) throw new Error('PIN_NAO_CONFIGURADO');

  const bloqueioRestante = minutosRestantesBloqueio(dadosAtuais);
  if (bloqueioRestante > 0) {
    const erro = new Error('PIN_BLOQUEADO');
    erro.minutosRestantes = bloqueioRestante;
    throw erro;
  }

  const hashTentativa = await hashComSalt(pin, dadosAtuais.pinSalt);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    const dados = snap.data();

    if (hashTentativa === dados.pinHash) {
      transaction.update(userRef, { pinTentativasFalhas: 0, pinBloqueadoAte: null });
      return true;
    }

    const tentativas = (dados.pinTentativasFalhas || 0) + 1;
    const atingiuLimite = tentativas >= PIN_MAX_TENTATIVAS;
    transaction.update(userRef, {
      pinTentativasFalhas: atingiuLimite ? 0 : tentativas,
      pinBloqueadoAte: atingiuLimite
        ? new Date(Date.now() + PIN_BLOQUEIO_MINUTOS * 60000)
        : dados.pinBloqueadoAte || null,
    });

    const erro = new Error('PIN_INCORRETO');
    erro.tentativasRestantes = atingiuLimite ? 0 : PIN_MAX_TENTATIVAS - tentativas;
    erro.bloqueado = atingiuLimite;
    throw erro;
  });
}

// ----------------------------------------------------------------------------
// RECUPERAÇÃO DE PIN POR E-MAIL
// ----------------------------------------------------------------------------
// Como a pessoa já está logada no app (Firebase Auth) quando esquece o PIN
// da carteira, a "recuperação" não precisa reconfirmar a identidade dela no
// app — só confirmar que ela tem acesso ao e-mail cadastrado, como uma
// segunda camada (útil se alguém pegar o celular já destravado). O código
// de 6 dígitos é gerado no aparelho, salvo (com hash) no próprio documento
// do usuário — permitido pela regra já existente de "a pessoa edita o
// próprio perfil" — e só o ENVIO do e-mail passa pela rota de servidor
// (app/api/recuperar-pin/route.js), porque só o servidor tem a chave da
// API de e-mail.
// ----------------------------------------------------------------------------

function gerarCodigoRecuperacao() {
  const numero = crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;
  return String(numero).padStart(6, '0');
}

/**
 * Gera um código de recuperação, salva o hash dele (com validade de
 * RECUPERACAO_EXPIRA_MINUTOS) no próprio documento do usuário e pede pra
 * rota de servidor enviar por e-mail. Lança 'FALHA_ENVIO_EMAIL' se o envio
 * falhar (o código já fica salvo mesmo assim, então dá pra tentar nova
 * solicitação sem problema).
 */
export async function solicitarRecuperacaoPin(perfil, email) {
  if (!email) throw new Error('EMAIL_INDISPONIVEL');

  const codigo = gerarCodigoRecuperacao();
  const salt = gerarSaltHex();
  const hash = await hashComSalt(codigo, salt);

  await updateDoc(doc(db, 'users', perfil.uid), {
    pinResetHash: hash,
    pinResetSalt: salt,
    pinResetExpiraEm: new Date(Date.now() + RECUPERACAO_EXPIRA_MINUTOS * 60000),
  });

  const resposta = await fetch('/api/recuperar-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, nome: perfil.nome, codigo }),
  });

  if (!resposta.ok) throw new Error('FALHA_ENVIO_EMAIL');
}

/**
 * Confirma o código de recuperação recebido por e-mail. Se bater e ainda
 * não tiver expirado, limpa o PIN atual (e o bloqueio, se houver) — a tela
 * então pode pedir pra pessoa criar um PIN novo com `configurarPin`. Lança
 * 'CODIGO_EXPIRADO' ou 'CODIGO_INCORRETO'.
 */
export async function confirmarRecuperacaoPin(uid, codigoDigitado) {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  const dados = snap.data();

  if (!dados?.pinResetHash || !dados?.pinResetExpiraEm) throw new Error('CODIGO_EXPIRADO');

  const expiraEm = dados.pinResetExpiraEm?.toMillis?.() || 0;
  if (Date.now() > expiraEm) throw new Error('CODIGO_EXPIRADO');

  const hashTentativa = await hashComSalt(codigoDigitado, dados.pinResetSalt);
  if (hashTentativa !== dados.pinResetHash) throw new Error('CODIGO_INCORRETO');

  await updateDoc(userRef, {
    pinHash: null,
    pinSalt: null,
    pinTentativasFalhas: 0,
    pinBloqueadoAte: null,
    pinResetHash: null,
    pinResetSalt: null,
    pinResetExpiraEm: null,
  });
}
