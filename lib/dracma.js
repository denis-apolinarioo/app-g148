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
  updateDoc,
  onSnapshot,
  query,
  where,
  limit as fbLimit,
} from 'firebase/firestore';
import { db } from './firebase';
import { registrarAcaoAdmin } from './adminLog';

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
 * pela tela Carteira. Só filtra por `uid` (sem orderBy combinado) de
 * propósito, mesmo motivo de `buscarAcoesAdminPorUsuario` em
 * lib/adminLog.js: consulta de um campo só não exige índice composto no
 * Firestore. A ordenação (mais recente primeiro) é feita no cliente.
 */
export function subscribeToDracmaLog(uid, callback, quantidade = 50) {
  const q = query(collection(db, 'dracmaLog'), where('uid', '==', uid), fbLimit(quantidade));
  return onSnapshot(
    q,
    (snap) => {
      const registros = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      registros.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      callback(registros);
    },
    (err) => {
      console.error('[subscribeToDracmaLog] Erro na escuta em tempo real:', err);
      callback([]);
    }
  );
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
