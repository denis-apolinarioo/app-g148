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
import { reportarConexaoOk, reportarErroConexao } from './connectivity';
import { registrarAcaoAdmin } from './adminLog';
import { verificarConquistas } from './achievements';

// ---------------------------------------------------------------------------
// Ordena documentos por createdAt (mais novo primeiro) no CLIENTE em vez de
// pedir pro Firestore (orderBy no servidor). Usado nas escutas que também
// filtram por uma pessoa (where autorId/destinatarioId) — combinar where +
// orderBy em campos diferentes exigiria criar um índice composto manualmente
// no Console do Firebase. Pra uma comunidade pequena (todo o histórico de uma
// pessoa cabe fácil em memória), ordenar aqui é mais simples e não depende de
// nenhuma configuração extra fora do código.
// Documentos recém-criados localmente (createdAt ainda não confirmado pelo
// servidor) contam como "mais novos" e vão pro topo, igual um orderBy normal
// se comportaria.
function ordenarPorCreatedAtDesc(docs) {
  return [...docs].sort((a, b) => {
    const tempoA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Infinity;
    const tempoB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Infinity;
    return tempoB - tempoA;
  });
}

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

  // "Tá On" — todo mundo ganha no 1º dia de app. Roda depois da transação
  // de criação do perfil (não trava o cadastro se falhar por algum motivo).
  try {
    await verificarConquistas(uid, 0, 'cadastro');
  } catch (err) {
    console.error('Erro ao conceder conquista de cadastro:', err);
  }
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
      reportarConexaoOk();
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => {
      console.error('[subscribeToUserProfile] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

// ---------------------------------------------------------------------------
// FEED / POSTS
// ---------------------------------------------------------------------------

export async function createPost({
  autor,
  tipo,
  texto,
  midiaURL,
  midiaThumbURL,
  categoria,
  categoriaAcaoId,
  origemMissaoId,
  origemMissaoSubmissaoId,
  itens,
  audioDuracaoSegundos,
}) {
  const postRef = await addDoc(collection(db, 'posts'), {
    autorId: autor.uid,
    autorNome: autor.nome,
    autorFoto: autor.fotoURL || '',
    autorUsername: autor.username,
    tipo, // 'texto' | 'foto' | 'audio'
    texto: texto || '',
    midiaURL: midiaURL || '',
    // Item 3 do Bloco A — versão reduzida da foto, usada nas listas (Feed)
    // pelos itens 9/10. Só existe quando tipo === 'foto'; vazio caso
    // contrário ou quando a origem (ex.: post automático de missão) ainda
    // não gera thumbnail.
    midiaThumbURL: midiaThumbURL || '',
    categoria: categoria || null, // nome da categoria, pro badge no PostCard (texto livre ou vindo de categoriasAcao)
    // FASE 2/3 — ID da categoria configurável (lib/categoriasAcaoRepo.js)
    // escolhida ao postar, quando houver. `null` pra post manual sem
    // categoria (ou de antes da Fase 3) e pra post automático de missão.
    categoriaAcaoId: categoriaAcaoId || null,
    // CONQUISTAS NOVAS — duração aproximada (segundos) do áudio do post,
    // quando tipo === 'audio'. Usado só por conquistas com exigência de
    // duração mínima (ex.: "Arautos da Shoppe"). `null` quando não se aplica.
    audioDuracaoSegundos: audioDuracaoSegundos || null,
    origemMissaoId: origemMissaoId || null,
    // CORREÇÃO DE BUG: guarda a submissão (missionSubmissions) que gerou
    // este post, pra dar pra achar ela de volta se o post for apagado (ver
    // removerPontosMissaoDoPostApagado em lib/points.js). `null` pra post
    // manual.
    origemMissaoSubmissaoId: origemMissaoSubmissaoId || null,
    // Lista ordenada de itens (foto/áudio/campos) pra montar a hierarquia
    // visual de um post automático de missão — ver lib/points.js
    // (montarItensDeMissao) e components/PostCard.js. `null` pra post
    // manual (criado direto no Feed, sem vir de missão).
    itens: itens || null,
    curtidas: [],
    comentariosCount: 0,
    createdAt: serverTimestamp(),
  });
  return postRef.id;
}

// Item 17 (Admin → Denúncias) — busca um único post pelo ID, usado pela
// tela de post individual (/post/[postId]) que o botão "Ver post" abre.
export function subscribeToPost(postId, callback) {
  return onSnapshot(
    doc(db, 'posts', postId),
    (snap) => {
      reportarConexaoOk();
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    },
    (err) => {
      console.error('[subscribeToPost] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

export function subscribeToFeed(callback, quantidade = 15) {
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), fbLimit(quantidade));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error('[subscribeToFeed] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

// Não usa orderBy no Firestore de propósito — combinado com o where(autorId)
// isso exigiria um índice composto manual. Em vez disso, pedimos só o filtro
// e ordenamos no cliente (ver ordenarPorCreatedAtDesc no topo do arquivo).
// Isso também resolve de vez o bug de curtida/edição/exclusão de post no
// Perfil que só atualizava saindo e voltando da tela.
export function subscribeToUserPosts(uid, callback) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(ordenarPorCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (err) => {
      console.error('[subscribeToUserPosts] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
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
      postId,
    });
  }

  // CONQUISTAS NOVAS — só checa ao CURTIR (não ao descurtir): "Multiplicador
  // de Likes" (curtidas dadas). "Luz do Feed" (curtidas RECEBIDAS) não pode
  // ser checada aqui: quem está curtindo não é o dono do post, e a regra do
  // Firestore só deixa cada pessoa criar a PRÓPRIA conquista
  // (achievementsUnlocked.uid == request.auth.uid) — checar a conquista de
  // outra pessoa a partir desta sessão sempre daria permissão negada. O dono
  // do post pega essa conquista sozinho, na sessão dele, pelo contexto
  // 'sessao' (ver contadorRelevantePara em lib/achievements.js e o useEffect
  // em components/AuthProvider.js) — no máximo 1 login de atraso.
  if (!jaCurtiu) {
    try {
      await verificarConquistas(uid, 0, 'curtida_dada');
    } catch (err) {
      console.error('Erro ao checar conquistas de curtida:', err);
    }
  }
}

// Casa @usuario dentro do texto — mesmos caracteres aceitos como username
// no cadastro (letras, números, ponto e underscore).
const REGEX_MENCAO = /@([a-zA-Z0-9_.]+)/g;

export async function addComment(postId, autor, texto, postAutorId) {
  await addDoc(collection(db, 'posts', postId, 'comentarios'), {
    autorId: autor.uid,
    autorNome: autor.nome,
    autorFoto: autor.fotoURL || '',
    texto,
    curtidas: [],
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { comentariosCount: increment(1) });

  // Menções via @usuario — resolve e GRAVA antes de checar conquistas, pra
  // 'mencoes_feitas_total' (ATUALIZAÇÃO CONQUISTAS) já entrar contado na
  // mesma checagem do comentário, logo abaixo. Grava em `mencoesLog`
  // (coleção nova) em vez de um contador denormalizado em users/{uid}: a
  // regra do Firestore só deixa cada pessoa escrever no PRÓPRIO documento
  // (ou o Admin, no de qualquer um) — não teria como creditar "menções
  // recebidas" na conta de OUTRA pessoa a partir desta sessão. Em
  // mencoesLog quem grava é sempre quem mencionou (remetenteId ==
  // auth.uid, ver firestore.rules), então funciona pras duas pontas:
  // 'mencoes_feitas_total' conta remetenteId==uid (pega agora, na própria
  // sessão), 'mencoes_recebidas_total' conta mencionadoId==uid (pega no
  // próximo login da pessoa mencionada — contexto 'sessao', mesma
  // limitação de curtida/comentário recebidos).
  const usernamesMencionados = [...new Set([...texto.matchAll(REGEX_MENCAO)].map((m) => m[1].toLowerCase()))];
  const mencionadosValidos = [];
  for (const username of usernamesMencionados) {
    try {
      const mencionado = await getUserByUsername(username);
      if (mencionado && mencionado.id !== autor.uid) {
        mencionadosValidos.push(mencionado);
        await addDoc(collection(db, 'mencoesLog'), {
          remetenteId: autor.uid,
          mencionadoId: mencionado.id,
          postId,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Erro ao resolver/gravar menção:', err);
    }
  }

  // CONQUISTAS NOVAS — "Jumenta de Balaão" (total de comentários feitos).
  // Contador denormalizado em users/{uid} (evita precisar de índice de
  // collection group pra contar comentários espalhados por vários posts).
  try {
    await updateDoc(doc(db, 'users', autor.uid), { totalComentariosFeitos: increment(1) });
    await verificarConquistas(autor.uid, 0, 'comentario');
  } catch (err) {
    console.error('Erro ao checar conquista de comentário:', err);
  }

  // Item 32 — notifica o dono do post sobre o novo comentário
  if (postAutorId) {
    await notificarInteracao({
      destinatarioId: postAutorId,
      remetente: autor,
      tipo: 'comentario',
      texto: `comentou: "${texto.length > 60 ? texto.slice(0, 60) + '…' : texto}"`,
      postId,
    });
  }

  // Notifica cada pessoa mencionada (uma vez cada, mesmo que citada 2x) —
  // gravação em mencoesLog já feita acima, aqui só falta o aviso.
  for (const mencionado of mencionadosValidos) {
    try {
      await notificarInteracao({
        destinatarioId: mencionado.id,
        remetente: autor,
        tipo: 'mencao',
        texto: `mencionou você em um comentário: "${texto.length > 60 ? texto.slice(0, 60) + '…' : texto}"`,
        postId,
      });
    } catch (err) {
      console.error('Erro ao notificar menção:', err);
    }
  }
}

export function subscribeToComments(postId, callback) {
  const q = query(collection(db, 'posts', postId, 'comentarios'), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error('[subscribeToComments] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
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

/**
 * Ocultar/reexibir um post. O dono pode ocultar/reexibir os PRÓPRIOS posts;
 * o Admin pode ocultar/reexibir QUALQUER post (nunca fica oculto pra ele
 * mesmo — a tela dele sempre mostra o conteúdo completo, ver PostCard.js).
 * Diferente de updatePost, este NÃO grava `editadoEm` — ocultar não é
 * "editar o conteúdo" do post, então não deve aparecer como "· editado".
 */
export async function alternarOcultarPost(postId, oculto, uid) {
  await updateDoc(
    doc(db, 'posts', postId),
    oculto
      ? { oculto: true, ocultoPor: uid, ocultoEm: serverTimestamp() }
      : { oculto: false, ocultoPor: '', ocultoEm: null }
  );
}

export async function deleteComment(postId, commentId) {
  await deleteDoc(doc(db, 'posts', postId, 'comentarios', commentId));
  await updateDoc(doc(db, 'posts', postId), { comentariosCount: increment(-1) });
}

/**
 * Item 20 — Curtir comentários. Mesmo padrão do toggleLike de posts, só que
 * no campo "curtidas" do documento do comentário (subcoleção).
 * `contexto` segue o mesmo formato do toggleLike: notifica só ao CURTIR
 * (nunca ao descurtir), e nunca a própria pessoa.
 */
export async function toggleCommentLike(postId, commentId, uid, jaCurtiu, contexto) {
  const commentRef = doc(db, 'posts', postId, 'comentarios', commentId);
  await updateDoc(commentRef, {
    curtidas: jaCurtiu ? arrayRemove(uid) : arrayUnion(uid),
  });

  if (!jaCurtiu && contexto?.comentarioAutorId) {
    await notificarInteracao({
      destinatarioId: contexto.comentarioAutorId,
      remetente: contexto.remetente,
      tipo: 'curtida_comentario',
      texto: 'curtiu seu comentário',
      postId,
    });
  }
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

  // CONQUISTAS NOVAS — "Um Orando por Todos, Todos Orando por Um" (combo:
  // pedido próprio + orou por outras pessoas). Só o pedido pode ter sido a
  // peça que faltava, então checa aqui também (além de checar no contexto
  // 'oracao', ao orar por alguém).
  try {
    await verificarConquistas(autor.uid, 0, 'pedido_criado');
  } catch (err) {
    console.error('Erro ao checar conquista de pedido de oração:', err);
  }
}

// Limitado aos pedidos mais recentes — diferente de subscribeToUserPosts/
// subscribeToUserPrayers (que filtram por UMA pessoa e por isso nunca
// crescem muito), este é o mural GERAL de todo mundo. Sem limite, ele
// cresceria pra sempre conforme a comunidade usa o app por anos.
// Trade-off consciente: como o limite conta TODOS os pedidos (ativos e já
// cumpridos) por data de criação, um pedido ativo muito antigo poderia,
// em tese, sair da lista se 50 pedidos mais novos (de qualquer status)
// se acumularem depois dele. Na prática — pedidos deviam ser marcados
// como cumpridos com uma certa frequência — isso não deve acontecer, mas
// se um dia a tela de Oração precisar garantir 100% que nenhum ativo suma,
// o ajuste é aumentar `quantidade` ou passar a filtrar por status no
// próprio Firestore.
export function subscribeToPrayers(callback, quantidade = 50) {
  const q = query(collection(db, 'prayers'), orderBy('createdAt', 'desc'), fbLimit(quantidade));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error('[subscribeToPrayers] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

// Mesmo motivo do subscribeToUserPosts: sem orderBy no Firestore de
// propósito, pra não depender de índice composto — ordena no cliente.
export function subscribeToUserPrayers(uid, callback) {
  const q = query(collection(db, 'prayers'), where('autorId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(ordenarPorCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (err) => {
      console.error('[subscribeToUserPrayers] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

export async function markPrayerAsDone(prayerId) {
  await updateDoc(doc(db, 'prayers', prayerId), { status: 'cumprido' });
}

/**
 * Apaga um pedido de oração. Diferente de apagar um post, isso NUNCA mexe
 * em pontos/Dracma/contagem de conquista de ninguém — nem do autor, nem de
 * quem orou por ele. O pedido simplesmente some. O que afeta pontuação é só
 * o desclique em "Orou hoje" (ver desfazerPontosOracao em lib/points.js);
 * apagar o pedido em si não desfaz nenhuma oração já registrada.
 */
export async function deletePrayer(prayerId) {
  await deleteDoc(doc(db, 'prayers', prayerId));
}

/**
 * Editar um pedido de oração (texto/prazo). Só dentro da janela de 24h, ver
 * podeEditarConteudoDoPrayer() no firestore.rules — mesma regra de 24h já
 * usada pra editar post (postAindaEditavel, lib/dateUtils.js). Grava
 * editadoEm pra podermos mostrar "(editado)" na tela, igual ao post.
 */
export async function updatePrayer(prayerId, dados) {
  await updateDoc(doc(db, 'prayers', prayerId), { ...dados, editadoEm: serverTimestamp() });
}

/**
 * Ocultar/reexibir um pedido de oração. O dono pode ocultar/reexibir os
 * PRÓPRIOS pedidos; o Admin pode ocultar/reexibir QUALQUER pedido (nunca
 * fica oculto pra ele mesmo). Mesmo padrão de alternarOcultarPost — sem
 * limite de 24h, e não grava editadoEm (ocultar não é "editar conteúdo").
 */
export async function alternarOcultarPrayer(prayerId, oculto, uid) {
  await updateDoc(
    doc(db, 'prayers', prayerId),
    oculto
      ? { oculto: true, ocultoPor: uid, ocultoEm: serverTimestamp() }
      : { oculto: false, ocultoPor: '', ocultoEm: null }
  );
}

/**
 * Verifica se `uid` já orou por `prayerId` HOJE (lê o mesmo documento
 * determinístico que registrarOracao/desfazerOracao usam). Usado pra descobrir o
 * estado real do botão "Orei por isso" ao montar a tela, em vez de sempre
 * assumir "não orou" — antes disso, sair e voltar da tela de Oração fazia o
 * botão voltar como se nunca tivesse sido clicado, mesmo já tendo orado.
 */
export async function jaOrouHoje(prayerId, uid) {
  const hoje = todayBrasilia();
  const interacaoRef = doc(db, 'prayers', prayerId, 'interacoes', `${uid}_${hoje}`);
  const snap = await getDoc(interacaoRef);
  return snap.exists();
}

/**
 * Registra que `uid` orou por `prayerId` HOJE, só se ainda não tinha orado
 * hoje (dedup pelo mesmo ID determinístico de sempre: `{uid}_{data}`).
 * Guarda `pontosGanhos` e `pointsLogId` dentro do próprio documento da
 * interação — é o que permite a desfazerOracao() (o "desclique") reverter
 * depois exatamente os pontos certos, nem mais nem menos.
 * Retorna `true` se registrou agora, `false` se já tinha orado hoje (não
 * mexe em nada nesse caso).
 */
export async function registrarOracao(prayerId, uid, pontosGanhos, pointsLogId) {
  const hoje = todayBrasilia();
  const interacaoRef = doc(db, 'prayers', prayerId, 'interacoes', `${uid}_${hoje}`);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(interacaoRef);
    if (snap.exists()) return false;
    transaction.set(interacaoRef, {
      uid,
      data: hoje,
      pontosGanhos,
      pointsLogId,
      createdAt: serverTimestamp(),
    });
    transaction.update(doc(db, 'prayers', prayerId), { totalOracoes: increment(1) });
    return true;
  });
}

/**
 * DESCLIQUE — desfaz a oração de hoje de `uid` por `prayerId`: apaga o
 * registro da interação e tira 1 do contador do pedido. Retorna os dados
 * que estavam salvos ({pontosGanhos, pointsLogId}) pra quem chamou poder
 * reverter os pontos também (lib/points.js), ou `null` se não havia oração
 * hoje pra desfazer (ex.: clique duplo).
 */
export async function desfazerOracao(prayerId, uid) {
  const hoje = todayBrasilia();
  const interacaoRef = doc(db, 'prayers', prayerId, 'interacoes', `${uid}_${hoje}`);

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(interacaoRef);
    if (!snap.exists()) return null;
    const dados = snap.data();
    transaction.delete(interacaoRef);
    transaction.update(doc(db, 'prayers', prayerId), { totalOracoes: increment(-1) });
    return { pontosGanhos: dados.pontosGanhos || 0, pointsLogId: dados.pointsLogId || null };
  });
}

// ---------------------------------------------------------------------------
// CORREIO (mensagens do admin + notificações automáticas de curtida/comentário)
// ---------------------------------------------------------------------------

export async function sendMailMessage(remetenteId, destinatarioId, texto, opts = {}) {
  const pontosAnexados = Number(opts.pontosAnexados) || 0;
  const dracmasAnexados = Number(opts.dracmasAnexados) || 0;
  const temRecompensa = pontosAnexados > 0 || dracmasAnexados > 0;
  await addDoc(collection(db, 'mailbox'), {
    remetenteId,
    destinatarioId,
    texto,
    tipo: 'mensagem',
    fotoURL: opts.fotoURL || '',
    // Item 3 do Bloco A — versão reduzida, usada na lista do Correio pelo item 10.
    fotoThumbURL: opts.fotoThumbURL || '',
    fixada: !!opts.fixada,
    // Item novo — "enviar pontos e dracmas pelo Correio": quando > 0, o
    // Correio (app/(app)/correio/page.js) mostra um botão "Receber" que
    // credita o valor só quando a pessoa toca nele (ver
    // resgatarRecompensaCorreio em lib/notificacoes.js). `resgatado` só
    // entra no documento quando existe alguma recompensa — mensagens sem
    // anexo continuam exatamente como antes.
    ...(temRecompensa ? { pontosAnexados, dracmasAnexados, resgatado: false } : {}),
    lida: false,
    createdAt: serverTimestamp(),
  });
}

/**
 * Item 36 — Envio em massa. Usa um batch (uma única operação atômica no
 * Firestore) em vez de N chamadas individuais.
 */
export async function sendMailToMultiple(remetenteId, destinatarioIds, texto, opts = {}) {
  const pontosAnexados = Number(opts.pontosAnexados) || 0;
  const dracmasAnexados = Number(opts.dracmasAnexados) || 0;
  const temRecompensa = pontosAnexados > 0 || dracmasAnexados > 0;
  const batch = writeBatch(db);
  destinatarioIds.forEach((destinatarioId) => {
    const ref = doc(collection(db, 'mailbox'));
    batch.set(ref, {
      remetenteId,
      destinatarioId,
      texto,
      tipo: 'mensagem',
      fotoURL: opts.fotoURL || '',
      // Item 3 do Bloco A — versão reduzida, usada na lista do Correio pelo item 10.
      fotoThumbURL: opts.fotoThumbURL || '',
      fixada: !!opts.fixada,
      // Ver comentário equivalente em sendMailMessage acima — cada pessoa
      // da lista ganha o MESMO valor anexado, resgatável individualmente.
      ...(temRecompensa ? { pontosAnexados, dracmasAnexados, resgatado: false } : {}),
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
async function notificarInteracao({ destinatarioId, remetente, tipo, texto, postId }) {
  if (!destinatarioId || !remetente?.uid || destinatarioId === remetente.uid) return;
  try {
    await addDoc(collection(db, 'mailbox'), {
      remetenteId: remetente.uid,
      destinatarioId,
      texto,
      tipo, // 'curtida' | 'comentario' | 'curtida_comentario' | 'mencao'
      remetenteNome: remetente.nome || '',
      remetenteFoto: remetente.fotoURL || '',
      remetenteUsername: remetente.username || '',
      // CORREÇÃO: antes esse tipo de mensagem não gravava `fixada` nenhum,
      // o que fazia a regra de exclusão do Firestore falhar (campo
      // inexistente) e impedia apagar essas notificações. Agora grava
      // explicitamente false, igual às mensagens do Admin.
      fixada: false,
      lida: false,
      // Item 15º do Bloco 7 — de onde veio a notificação, pra clicar levar
      // direto ao post curtido/comentado em vez de só abrir o Correio.
      postId: postId || '',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao criar notificação:', err);
  }
}

// Mesmo motivo: sem orderBy no Firestore, ordena no cliente — evita índice
// composto pra where(destinatarioId) + ordenação por data.
export function subscribeToMailbox(uid, callback) {
  const q = query(collection(db, 'mailbox'), where('destinatarioId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(ordenarPorCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (err) => {
      console.error('[subscribeToMailbox] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
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
    (snap) => {
      reportarConexaoOk();
      callback(snap.size);
    },
    (err) => {
      console.error('[subscribeToUnreadMailCount] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

export async function markMailAsRead(messageId) {
  await updateDoc(doc(db, 'mailbox', messageId), { lida: true });
}

/**
 * Item 14º do Bloco 7 — histórico de mensagens enviadas pelo Admin (tipo
 * 'mensagem' só — não lista as notificações automáticas de curtida/
 * comentário, que não são "mensagens" no sentido do Correio do Admin).
 * `destinatarioId` opcional filtra por pessoa; sem ele, traz o histórico
 * geral (todo mundo). Dois filtros de igualdade (tipo + destinatarioId),
 * sem orderBy — mesmo motivo de sempre, evita índice composto.
 */
export function subscribeToMailHistory(callback, destinatarioId = null) {
  const condicoes = [where('tipo', '==', 'mensagem')];
  if (destinatarioId) condicoes.push(where('destinatarioId', '==', destinatarioId));
  const q = query(collection(db, 'mailbox'), ...condicoes);
  return onSnapshot(
    q,
    (snap) => {
      reportarConexaoOk();
      callback(ordenarPorCreatedAtDesc(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
    },
    (err) => {
      console.error('[subscribeToMailHistory] Erro na escuta em tempo real:', err);
      reportarErroConexao();
    }
  );
}

/**
 * Item 14º — apagar qualquer mensagem do histórico (precisa da regra de
 * `delete` liberada pro Admin no firestore.rules). Se a mensagem estava
 * fixada, o próprio onSnapshot de quem recebeu já reflete o sumiço na hora
 * — não precisa de nenhuma limpeza extra em outro lugar.
 */
export async function deleteMailMessage(messageId) {
  await deleteDoc(doc(db, 'mailbox', messageId));
}

/**
 * Botão "Limpar tudo" do Correio — apaga de uma vez todas as mensagens NÃO
 * fixadas do destinatário (as fixadas só saem quando o Admin apaga, ver
 * deleteMailMessage acima). Recebe a lista de IDs já filtrada no cliente
 * (app/(app)/correio/page.js já mantém o histórico completo carregado
 * localmente via subscribeToMailbox, então não precisa de uma nova consulta
 * ao Firestore). Usa lotes de até 450 operações por writeBatch — o limite
 * do Firestore é 500 por lote.
 */
export async function limparMailboxNaoFixadas(messageIds) {
  const TAMANHO_LOTE = 450;
  for (let i = 0; i < messageIds.length; i += TAMANHO_LOTE) {
    const lote = messageIds.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    lote.forEach((id) => batch.delete(doc(db, 'mailbox', id)));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}

// (funções de "Desafios individuais" removidas — aba descontinuada)

// ---------------------------------------------------------------------------
// LISTAGEM DE USUÁRIOS (usado no admin e no correio)
// ---------------------------------------------------------------------------

export async function getAllUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('nome', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * BUG CORRIGIDO — PACOTE 1 (2 moedas): esta função era chamada pelo botão
 * "Ativar Dracma pra quem já estava cadastrado" (app/(app)/admin/
 * _components/AbaUsuarios.js) mas nunca existia em lugar nenhum do código,
 * então o botão sempre quebrava (TypeError: migrarDracmasDosUsuarios is not
 * a function). Garante que todo mundo já cadastrado tenha o campo `dracmas`
 * (só grava em quem ainda não tem o campo — seguro clicar mais de uma vez).
 * Mesmo padrão de lote de limparMailboxNaoFixadas() acima.
 */
export async function migrarDracmasDosUsuarios() {
  const usuarios = await getAllUsers();
  const semDracma = usuarios.filter((u) => u.dracmas === undefined);

  const TAMANHO_LOTE = 450;
  for (let i = 0; i < semDracma.length; i += TAMANHO_LOTE) {
    const lote = semDracma.slice(i, i + TAMANHO_LOTE);
    const batch = writeBatch(db);
    lote.forEach((u) => batch.update(doc(db, 'users', u.id), { dracmas: 0 }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  return semDracma.length;
}

// ---------------------------------------------------------------------------
// TRAVAR/DESTRAVAR USUÁRIO (item 13 do Bloco 6) — o Admin trava o acesso de
// alguém sem precisar mexer no Firebase Console. Como `perfil` no
// AuthProvider vem de um listener em tempo real (subscribeToUserProfile), o
// travamento vale IMEDIATAMENTE pra pessoa mesmo que ela já esteja logada e
// com o app aberto — não precisa deslogar ninguém pra isso funcionar (ver
// app/(app)/layout.js, que mostra a tela de bloqueio assim que `travado`
// vira true).
//
// Exige regra nova no Firestore (campo `travado` liberado pro Admin editar
// em users/{userId}, e bloqueado pra própria pessoa alterar em si mesma —
// mesma lógica já usada pra `isAdmin`). Ver firestore.rules.
// ---------------------------------------------------------------------------
export async function toggleTravarUsuario(uid, travar, admin) {
  await updateDoc(doc(db, 'users', uid), { travado: travar });
  await registrarAcaoAdmin({
    admin,
    acao: travar ? 'travar_usuario' : 'destravar_usuario',
    alvoTipo: 'users',
    alvoId: uid,
    valorAntes: !travar,
    valorDepois: travar,
  });
}

// ---------------------------------------------------------------------------
// DENÚNCIAS (item 17) — registro simples de post/comentário denunciado,
// achatado (guarda um trecho do conteúdo e o autor original) pra o Admin
// não precisar buscar o post/comentário de novo só pra montar a lista.
// Sem nenhuma ação automática: só junta a denúncia pra decisão manual.
// ---------------------------------------------------------------------------

export async function createReport({ tipo, postId, commentId, conteudoAutorId, conteudoTexto, motivo, reportador }) {
  await addDoc(collection(db, 'reports'), {
    tipo, // 'post' | 'comentario'
    postId,
    commentId: commentId || null,
    conteudoAutorId,
    conteudoTexto: (conteudoTexto || '').slice(0, 200),
    motivo: (motivo || '').trim(),
    reportadoPorId: reportador?.uid || null,
    reportadoPorNome: reportador?.nome || '',
    status: 'pendente', // 'pendente' | 'resolvida'
    createdAt: serverTimestamp(),
  });
}

export function subscribeToReports(callback) {
  const q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => console.error('[subscribeToReports] Erro na escuta em tempo real:', err)
  );
}

export async function marcarDenunciaResolvida(reportId, resolvida = true, admin, contextoDenuncia = '') {
  await updateDoc(doc(db, 'reports', reportId), { status: resolvida ? 'resolvida' : 'pendente' });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: resolvida ? 'resolver_denuncia' : 'reabrir_denuncia',
      alvoTipo: 'reports',
      alvoId: reportId,
      detalhes: contextoDenuncia,
    });
  }
}

// ---------------------------------------------------------------------------
// BLOQUEAR/SILENCIAR USUÁRIO (item 18) — lista de uids bloqueados no próprio
// documento do usuário; o Feed filtra os posts dessas pessoas no cliente.
// Não precisa de regra nova no Firestore: a regra de users/{userId} já
// permite que a própria pessoa altere qualquer campo do seu perfil, menos
// `isAdmin`.
// ---------------------------------------------------------------------------

export async function toggleBlockUser(uidAtual, uidAlvo, jaBloqueado) {
  await updateDoc(doc(db, 'users', uidAtual), {
    bloqueados: jaBloqueado ? arrayRemove(uidAlvo) : arrayUnion(uidAlvo),
  });
}
