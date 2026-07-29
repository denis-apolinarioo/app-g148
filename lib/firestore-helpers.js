// ============================================================================
// Funções de acesso ao Firestore relacionadas a USUÁRIOS, POSTS e ORAÇÃO.
// As funções de MISSÕES e PONTOS ficam em lib/points.js (arquivo separado
// porque a lógica de pontuação precisa ficar bem isolada e fácil de auditar).
// ============================================================================
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';

// ---------------------------------------------------------------------------
// USUÁRIOS
// ---------------------------------------------------------------------------

export async function isUsernameAvailable(username) {
  const ref = doc(db, 'usernames', username.toLowerCase());
  const snap = await getDoc(ref);
  return !snap.exists();
}

export async function createUserProfile(uid, data) {
  const usernameLower = data.username.toLowerCase();

  const available = await isUsernameAvailable(usernameLower);
  if (!available) {
    throw new Error('USERNAME_INDISPONIVEL');
  }

  // Reserva o nome de usuário e cria o perfil "ao mesmo tempo" (transação),
  // pra evitar que duas pessoas peguem o mesmo @usuario numa corrida rara.
  await runTransaction(db, async (transaction) => {
    const usernameRef = doc(db, 'usernames', usernameLower);
    const usernameSnap = await transaction.get(usernameRef);
    if (usernameSnap.exists()) {
      throw new Error('USERNAME_INDISPONIVEL');
    }
    transaction.set(usernameRef, { uid });

    const userRef = doc(db, 'users', uid);
    transaction.set(userRef, {
      uid,
      nome: data.nome,
      username: usernameLower,
      dataNascimento: data.dataNascimento,
      fotoURL: data.fotoURL || '',
      proposito: data.proposito || '',
      bio: '',
      musicaFavorita: '',
      tagFuncao: 'Membro',
      pontos: 0,
      isAdmin: false,
      streakAtual: 0,
      streakRecorde: 0,
      ultimoDiaAtivo: null,
      onboardingCompleto: true,
      createdAt: serverTimestamp(),
    });
  });
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function getUserByUsername(username) {
  const usernameSnap = await getDoc(doc(db, 'usernames', username.toLowerCase()));
  if (!usernameSnap.exists()) return null;
  const { uid } = usernameSnap.data();
  return getUserProfile(uid);
}

export async function updateUserProfile(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

export function subscribeToUserProfile(uid, callback) {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => console.error('[subscribeToUserProfile] Erro na escuta em tempo real:', err)
  );
}

// ---------------------------------------------------------------------------
// FEED / POSTS
// ---------------------------------------------------------------------------

export async function createPost({ autor, tipo, texto, midiaURL, categoria, origemMissaoId }) {
  const postRef = await addDoc(collection(db, 'posts'), {
    autorId: autor.uid,
    autorNome: autor.nome,
    autorFoto: autor.fotoURL || '',
    autorUsername: autor.username,
    tipo, // 'texto' | 'foto' | 'audio'
    texto: texto || '',
    midiaURL: midiaURL || '',
    categoria: categoria || null, // 'Oração' | 'Relato' | null
    origemMissaoId: origemMissaoId || null,
    curtidas: [],
    comentariosCount: 0,
    createdAt: serverTimestamp(),
  });
  return postRef.id;
}

export function subscribeToFeed(callback, quantidade = 15) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fbLimit(quantidade));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToFeed] Erro na escuta em tempo real:', err)
  );
}

// FIX: essa busca combina where(autorId) + orderBy(createdAt), o que exige um
// índice composto no Firestore (ver firestore.indexes.json). Sem esse índice
// a escuta em tempo real falha silenciosamente depois da primeira leitura —
// os dados aparecem certos ao abrir a tela, mas curtidas/edições feitas
// enquanto ela está aberta não chegam até sair e voltar. O callback de erro
// abaixo garante que, se isso (ou qualquer outro problema de escuta)
// acontecer de novo, apareça no console em vez de falhar em silêncio.
export function subscribeToUserPosts(uid, callback) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToUserPosts] Erro na escuta em tempo real:', err)
  );
}

export async function toggleLike(postId, uid, jaCurtiu, contexto) {
  const postRef = doc(db, 'posts', postId);
  await updateDoc(postRef, {
    curtidas: jaCurtiu ? arrayRemove(uid) : arrayUnion(uid),
  });

  // Item 32 — notifica o dono do post ao CURTIR (nunca ao descurtir)
  if (!jaCurtiu && contexto?.postAutorId) {
    await notificarInteracao({
      destinatarioId: contexto.postAutorId,
      remetente: contexto.remetente,
      tipo: 'curtida',
      texto: 'curtiu sua publicação',
    });
  }
}

export async function addComment(postId, autor, texto, postAutorId) {
  await addDoc(collection(db, 'posts', postId, 'comentarios'), {
    autorId: autor.uid,
    autorNome: autor.nome,
    autorFoto: autor.fotoURL || '',
    texto,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { comentariosCount: increment(1) });

  // Item 32 — notifica o dono do post sobre o novo comentário
  if (postAutorId) {
    await notificarInteracao({
      destinatarioId: postAutorId,
      remetente: autor,
      tipo: 'comentario',
      texto: `comentou: "${texto.length > 60 ? texto.slice(0, 60) + '…' : texto}"`,
    });
  }
}

export function subscribeToComments(postId, callback) {
  const q = query(collection(db, 'posts', postId, 'comentarios'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToComments] Erro na escuta em tempo real:', err)
  );
}

export async function deletePost(postId) {
  await deleteDoc(doc(db, 'posts', postId));
}

/**
 * Item 15 — Editar post. Só o texto/legenda é editável (mídia não muda).
 * Grava editadoEm pra podermos mostrar "(editado)" na tela.
 */
export async function updatePost(postId, dados) {
  await updateDoc(doc(db, 'posts', postId), { ...dados, editadoEm: serverTimestamp() });
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, 'posts', postId, 'comentarios', commentId));
  await updateDoc(doc(db, 'posts', postId), { comentariosCount: increment(-1) });
}

/**
 * Item 20 — Curtir comentários. Mesmo padrão do toggleLike de posts, só que
 * no campo "curtidas" do documento do comentário (subcoleção).
 */
export async function toggleCommentLike(postId, commentId, uid, jaCurtiu) {
  const commentRef = doc(db, 'posts', postId, 'comentarios', commentId);
  await updateDoc(commentRef, {
    curtidas: jaCurtiu ? arrayRemove(uid) : arrayUnion(uid),
  });
}

// ---------------------------------------------------------------------------
// ORAÇÃO
// ---------------------------------------------------------------------------

export async function createPrayer(autor, descricao, prazo) {
  await addDoc(collection(db, 'prayers'), {
    autorId: autor.uid,
    autorNome: autor.nome,
    autorFoto: autor.fotoURL || '',
    autorUsername: autor.username,
    descricao,
    prazo, // YYYY-MM-DD
    status: 'ativo',
    totalOracoes: 0,
    createdAt: serverTimestamp(),
  });
}

export function subscribeToPrayers(callback) {
  const q = query(collection(db, 'prayers'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToPrayers] Erro na escuta em tempo real:', err)
  );
}

// FIX: mesmo padrão where(autorId) + orderBy(createdAt) do subscribeToUserPosts
// — também precisa do índice composto (ver firestore.indexes.json).
export function subscribeToUserPrayers(uid, callback) {
  const q = query(collection(db, 'prayers'), where('autorId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToUserPrayers] Erro na escuta em tempo real:', err)
  );
}

export async function markPrayerAsDone(prayerId) {
  await updateDoc(doc(db, 'prayers', prayerId), { status: 'cumprido' });
}

/**
 * Registra que `uid` orou pelo pedido `prayerId`. Só permite 1 vez por dia
 * por pessoa por pedido (dedup via ID determinístico do documento). Os
 * pontos por orar são concedidos em lib/points.js (awardPoints), chamado
 * por quem consome esta função na tela.
 * Retorna `true` se registrou com sucesso, `false` se a pessoa já tinha
 * orado por esse pedido hoje.
 */
export async function registerPrayerInteraction(prayerId, uid) {
  const hoje = todayBrasilia();
  const interacaoRef = doc(db, 'prayers', prayerId, 'interacoes', `${uid}_${hoje}`);

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(interacaoRef);
      if (snap.exists()) {
        throw new Error('JA_OROU_HOJE');
      }
      transaction.set(interacaoRef, { uid, data: hoje, createdAt: serverTimestamp() });
      transaction.update(doc(db, 'prayers', prayerId), { totalOracoes: increment(1) });
    });
    return true;
  } catch (err) {
    if (err.message === 'JA_OROU_HOJE') return false;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// CORREIO (mensagens do admin + notificações automáticas de curtida/comentário)
// ---------------------------------------------------------------------------

export async function sendMailMessage(remetenteId, destinatarioId, texto, opts = {}) {
  await addDoc(collection(db, 'mailbox'), {
    remetenteId,
    destinatarioId,
    texto,
    tipo: 'mensagem',
    fotoURL: opts.fotoURL || '',
    fixada: !!opts.fixada,
    lida: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Item 36 — Envio em massa. Usa um batch (uma única operação atômica no
 * Firestore) em vez de N chamadas individuais.
 */
export async function sendMailToMultiple(remetenteId, destinatarioIds, texto, opts = {}) {
  const batch = writeBatch(db);
  destinatarioIds.forEach((destinatarioId) => {
    const ref = doc(collection(db, 'mailbox'));
    batch.set(ref, {
      remetenteId,
      destinatarioId,
      texto,
      tipo: 'mensagem',
      fotoURL: opts.fotoURL || '',
      fixada: !!opts.fixada,
      lida: false,
      createdAt: serverTimestamp(),
    });
  });
  await batch.commit();
}

/**
 * Item 32 — Notificação automática de curtida/comentário, entregue no
 * Correio de quem é dono do post. Nunca notifica a própria pessoa.
 * Se falhar, não deve travar a curtida/comentário em si — só loga o erro.
 */
async function notificarInteracao({ destinatarioId, remetente, tipo, texto }) {
  if (!destinatarioId || !remetente?.uid || destinatarioId === remetente.uid) return;
  try {
    await addDoc(collection(db, 'mailbox'), {
      remetenteId: remetente.uid,
      destinatarioId,
      texto,
      tipo, // 'curtida' | 'comentario'
      remetenteNome: remetente.nome || '',
      remetenteFoto: remetente.fotoURL || '',
      remetenteUsername: remetente.username || '',
      lida: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
}

// FIX: mesmo padrão where(destinatarioId) + orderBy(createdAt) — precisa do
// índice composto (ver firestore.indexes.json).
export function subscribeToMailbox(uid, callback) {
  const q = query(
    collection(db, 'mailbox'),
    where('destinatarioId', '==', uid),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToMailbox] Erro na escuta em tempo real:', err)
  );
}

/**
 * Item 30 — Contagem de não lidas, para a bolinha no ícone do Correio.
 * Só filtros de igualdade (destinatarioId, lida) — não precisa de índice
 * composto no Firestore.
 */
export function subscribeToUnreadMailCount(uid, callback) {
  const q = query(
    collection(db, 'mailbox'),
    where('destinatarioId', '==', uid),
    where('lida', '==', false)
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.size),
    (err) => console.error('[subscribeToUnreadMailCount] Erro na escuta em tempo real:', err)
  );
}

export async function markMailAsRead(messageId) {
  await updateDoc(doc(db, 'mailbox', messageId), { lida: true });
}

// ---------------------------------------------------------------------------
// DESAFIOS INDIVIDUAIS (criados pelo admin, aprovados manualmente)
// ---------------------------------------------------------------------------

export async function createChallenge({ destinatarioId, criadoPor, titulo, descricao, pontos }) {
  await addDoc(collection(db, 'challenges'), {
    destinatarioId,
    criadoPor,
    titulo,
    descricao,
    pontos,
    status: 'pendente_execucao', // pendente_execucao -> aguardando_aprovacao -> aprovado/rejeitado
    createdAt: serverTimestamp(),
  });
}

// FIX: mesmo padrão where(destinatarioId) + orderBy(createdAt) — precisa do
// índice composto (ver firestore.indexes.json).
export function subscribeToUserChallenges(uid, callback) {
  const q = query(collection(db, 'challenges'), where('destinatarioId', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToUserChallenges] Erro na escuta em tempo real:', err)
  );
}

export function subscribeToPendingChallenges(callback) {
  const q = query(collection(db, 'challenges'), where('status', '==', 'aguardando_aprovacao'));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => console.error('[subscribeToPendingChallenges] Erro na escuta em tempo real:', err)
  );
}

export async function markChallengeAwaitingApproval(challengeId) {
  await updateDoc(doc(db, 'challenges', challengeId), { status: 'aguardando_aprovacao' });
}

// ---------------------------------------------------------------------------
// LISTAGEM DE USUÁRIOS (usado no admin e no correio)
// ---------------------------------------------------------------------------

export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('nome', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
