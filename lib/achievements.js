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
  addDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { getTodasAsConquistas, getConquistaPorId } from './conquistasRepo';
import { contarAcoesCategoriaTotal } from './acoesLog';
import { vibrarConquista } from './haptics';
import { dateStrBrasilia, horaBrasilia } from './dateUtils';
import { MISSOES_ORACAO_IDS, MADRUGADA_HORA_INICIO, MADRUGADA_HORA_FIM } from './constants';
import { registrarAcaoAdmin } from './adminLog';

/**
 * Notificação (Correio + push, via a Cloud Function genérica que dispara em
 * qualquer novo documento de `mailbox`) de conquista destravada, com botão
 * pra ir direto até ela (ver LinhaMensagem em app/(app)/correio/page.js e a
 * leitura do parâmetro `?conquista=` em app/(app)/perfil/page.js). Como é a
 * própria pessoa notificando a si mesma (remetenteId === destinatarioId), a
 * regra do Firestore para o tipo 'conquista' exige isso explicitamente —
 * ver firestore.rules. Fica aqui (e não em lib/notificacoes.js) só pra
 * evitar import circular: lib/notificacoes.js já precisa importar
 * verificarConquistas deste arquivo.
 *
 * ATUALIZAÇÃO — a recompensa (pontosRecompensa/dracmaRecompensa) não é mais
 * creditada na hora do desbloqueio: ela vai anexada nesta mensagem
 * (pontosAnexados/dracmasAnexados + resgatado: false), igual já funciona
 * pra pontos/dracma enviados pelo Admin pelo Correio (ver AbaCorreio.js e
 * resgatarRecompensaCorreio em lib/notificacoes.js). A pessoa só recebe de
 * fato ao tocar "Receber" na mensagem — o botão (BlocoRecompensaCorreio em
 * app/(app)/correio/page.js) já é genérico, não precisou mudar nada lá: ele
 * aparece pra QUALQUER mensagem com esses campos, não só pontos_admin/
 * dracma_admin.
 */
async function notificarConquista(uid, conquista) {
  try {
    await addDoc(collection(db, 'mailbox'), {
      remetenteId: uid,
      destinatarioId: uid,
      tipo: 'conquista',
      texto: `Você desbloqueou "${conquista.nome}"!`,
      achievementId: conquista.id,
      conquistaNome: conquista.nome || '',
      conquistaImagemURL: conquista.imagemURL || '',
      pontosAnexados: conquista.pontosRecompensa || 0,
      dracmasAnexados: conquista.dracmaRecompensa || 0,
      resgatado: false,
      fixada: false,
      lida: false,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error('Erro ao criar notificação de conquista:', err);
  }
}

async function jaDesbloqueada(uid, achievementId) {
  const snap = await getDoc(doc(db, 'achievementsUnlocked', `${uid}_${achievementId}`));
  return snap.exists();
}

/**
 * Grava o desbloqueio da conquista. ATUALIZAÇÃO — não credita mais a
 * recompensa aqui: ela vai anexada na mensagem do Correio criada por
 * notificarConquista() logo depois (ver comentário lá) e só é creditada
 * quando a pessoa toca "Receber" (resgatarRecompensaCorreio, em
 * lib/notificacoes.js — mesma função já usada pra pontos/dracma enviados
 * pelo Admin). Vale igual pra automática e manual: concederConquistaManualmente
 * também passa por este desbloquear().
 */
async function desbloquear(uid, conquista) {
  const jaTem = await jaDesbloqueada(uid, conquista.id);
  if (jaTem) return false;
  await setDoc(doc(db, 'achievementsUnlocked', `${uid}_${conquista.id}`), {
    uid,
    achievementId: conquista.id,
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

async function contarSubmissoes(uid, missaoId, desde = null) {
  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missaoId)
  );
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).length;
}

async function contarPosts(uid, desde = null) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  // CORREÇÃO DE BUG (botão "encaminhar" quebrado em missão sem feed) — não
  // conta o post "de bastidor" (missaoSemFeed, ver lib/points.js) de quem
  // cumpre uma missão que não posta: pra essa conquista ("postou X
  // vezes"), isso não é uma publicação de verdade, é só um registro
  // interno pra dar pra "encaminhar"/excluir a missão depois.
  const postsDeVerdade = snap.docs.filter((d) => !d.data().missaoSemFeed);
  return filtraPorData(postsDeVerdade, desde).length;
}

/**
 * CONQUISTAS NOVAS (bloco "25 conquistas") — helpers de contagem abaixo.
 * Seguem o mesmo padrão de sempre (busca por um campo só, filtra/agrupa em
 * memória) pra não exigir nenhum índice composto novo no Firestore.
 */

// "Luz do Feed" — quantos posts PRÓPRIOS já bateram `minimo` de curtidas.
async function contarPostsComCurtidasMin(uid, minimo) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => (d.data().curtidas || []).length >= minimo).length;
}

// "Multiplicador de Likes" — em quantos posts (de qualquer pessoa) o
// usuário deixou curtida. `curtidas` é um array, então array-contains já
// garante 1 por post (curtir/descurtir/curtir de novo não duplica).
async function contarPostsCurtidosPeloUsuario(uid) {
  const q = query(collection(db, 'posts'), where('curtidas', 'array-contains', uid));
  const snap = await getDocs(q);
  return snap.size;
}

// "Jumenta de Balaão" — total de comentários feitos pelo usuário. Lido de
// um contador denormalizado em users/{uid}.totalComentariosFeitos (em vez
// de uma collectionGroup query em `comentarios`, que exigiria criar um
// índice manual no Firestore Console) — ver addComment em
// lib/firestore-helpers.js, que incrementa esse campo.
async function contarComentariosDoUsuario(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.totalComentariosFeitos || 0;
}

// "Daniel na Janelinha" — dias (fuso Brasília) em que o usuário cumpriu as
// 3 missões de oração diária (MISSOES_ORACAO_IDS) NO MESMO DIA.
async function contarDiasComTresOracoes(uid) {
  const q = query(collection(db, 'missionSubmissions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  const diasPorMissao = {}; // { 'YYYY-MM-DD': Set(missaoId) }
  snap.docs.forEach((d) => {
    const dados = d.data();
    if (!MISSOES_ORACAO_IDS.includes(dados.missaoId) || !dados.createdAt) return;
    const dia = dateStrBrasilia(dados.createdAt);
    if (!diasPorMissao[dia]) diasPorMissao[dia] = new Set();
    diasPorMissao[dia].add(dados.missaoId);
  });
  return Object.values(diasPorMissao).filter((set) => set.size >= MISSOES_ORACAO_IDS.length).length;
}

// "Sagrado Despertador" — quantas vezes uma das 3 missões de oração diária
// foi cumprida dentro da janela de madrugada (MADRUGADA_HORA_INICIO/FIM,
// lib/constants.js), com base no horário real de envio da missão.
async function contarOracoesDeMadrugada(uid) {
  const q = query(collection(db, 'missionSubmissions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const dados = d.data();
    if (!MISSOES_ORACAO_IDS.includes(dados.missaoId) || !dados.createdAt) return false;
    const hora = horaBrasilia(dados.createdAt);
    return hora >= MADRUGADA_HORA_INICIO && hora < MADRUGADA_HORA_FIM;
  }).length;
}

// "Paulo no Whatsapp" — quantas vezes o usuário mandou ÁUDIO numa das 3
// missões de oração diária.
async function contarOracoesComAudio(uid) {
  const q = query(collection(db, 'missionSubmissions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const dados = d.data();
    return MISSOES_ORACAO_IDS.includes(dados.missaoId) && !!dados.audioURL;
  }).length;
}

// "Arautos da Shoppe" — posts numa categoria específica (ex.: "Música") com
// áudio de pelo menos `segundosMin` segundos.
async function contarPostsCategoriaComAudioMin(uid, categoriaId, segundosMin) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return snap.docs.filter((d) => {
    const dados = d.data();
    return dados.categoriaAcaoId === categoriaId && (dados.audioDuracaoSegundos || 0) >= segundosMin;
  }).length;
}

// "Mil e um Talentos" — quantas conquistas diferentes o usuário já
// desbloqueou (checado DEPOIS do restante do lote, ver verificarConquistas).
async function contarConquistasDesbloqueadas(uid) {
  const q = query(collection(db, 'achievementsUnlocked'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return snap.size;
}

// "Adão e Eva do App" — dias desde a criação da conta.
async function calcularIdadeContaEmDias(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  const createdAt = snap.data()?.createdAt;
  if (!createdAt?.toDate) return 0;
  const diffMs = Date.now() - createdAt.toDate().getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

// "Um Orando por Todos, Todos Orando por Um" — combo: fez pelo menos 1
// pedido de oração PRÓPRIO E orou por pelo menos `minimoOracoes` pedidos
// (mesma contagem usada pelo contadorTipo 'oracao'). Retorna a contagem de
// orações só se o pedido próprio existir — senão retorna 0 (nunca bate a
// meta sem o pedido, mesmo que já tenha orado bastante por outros).
async function contarComboPedidoEOracoes(uid, minimoOracoes) {
  const qPedido = query(collection(db, 'prayers'), where('autorId', '==', uid));
  const snapPedido = await getDocs(qPedido);
  if (snapPedido.empty) return 0;

  const qOracao = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
  const snapOracao = await getDocs(qOracao);
  return snapOracao.size >= minimoOracoes ? minimoOracoes : snapOracao.size;
}

// "Planando como Águia" — dias seguidos em 1º lugar no ranking, mantido em
// users/{uid}.top1DiasSeguidos por lib/rankingStreak.js (checado toda vez
// que a pessoa abre a tela de Ranking e está em 1º — ver
// app/(app)/ranking/page.js). LIMITAÇÃO CONHECIDA E ACEITA: sem Cloud
// Functions/cron, não dá pra vigiar "nem 1 segundo fora do 1º lugar" o
// tempo todo — a checagem é por visita à tela de Ranking, granularidade de
// dia (Brasília), não de segundo.
async function lerTop1DiasSeguidos(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.top1DiasSeguidos || 0;
}

/**
 * Conquistas de Dracma — soma o campo `valor` de todas as entradas do
 * `dracmaLog` recebidas por `uid` cujo `tipo` esteja em `tiposValidos`.
 * Usado por `contadorTipo: 'dracma_ganho_total'` (total ganho na vida, sem
 * descontar o que já foi gasto/transferido depois).
 */
async function somarDracmaLog(uid, tiposValidos, desde = null) {
  // CORREÇÃO DE BUG Nº2 (achada na Atualização de Conquistas): filtrava por
  // `destino`, mas creditarDracma()/ajustarDracmaManualmente() (ambos em
  // lib/dracma.js) gravam o destinatário no campo `uid` — só entrada de
  // tipo 'transferencia' (peer-to-peer) tem origem/destino. Combinado com
  // os tipos errados que este contador buscava antes (ver o comentário em
  // calcularContador, acima), o resultado era sempre 0 — dupla causa pro
  // mesmo sintoma.
  const q = query(
    collection(db, 'dracmaLog'),
    where('uid', '==', uid),
    where('tipo', 'in', tiposValidos)
  );
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).reduce((total, d) => total + (d.data().valor || 0), 0);
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
 * ATUALIZAÇÃO CONQUISTAS — helpers de contagem novos, um por contador da
 * lista pedida no documento "Sistema de Conquistas - Atualização". Seguem
 * o mesmo padrão de sempre (busca por um campo só, filtra em memória, sem
 * índice composto novo). Vários aceitam `desde` (Date opcional), usado pelo
 * modo "Obtido Durante o Período" de um contador dentro de uma conquista
 * com múltiplos contadores (ver avaliarConquistaMultiContador mais abaixo)
 * — filtra só registros com `createdAt` a partir dali.
 *
 * Contadores baseados em ESTADO atual sem log histórico (streak, saldo,
 * dias seguidos no ranking, e os denormalizados abaixo — menções,
 * comentários recebidos) não têm como respeitar esse filtro: um número que
 * só existe "agora" não tem como ser "datado". Nesses, `desde` é ignorado —
 * na prática o modo se comporta como Estado Atual mesmo que a conquista
 * peça outro. LIMITAÇÃO CONHECIDA E ACEITA, mesmo espírito de outras já
 * documentadas neste arquivo.
 */
function filtraPorData(docs, desde) {
  if (!desde) return docs;
  const desdeMs = desde.getTime();
  return docs.filter((d) => {
    const createdAt = d.data().createdAt;
    return !!createdAt?.toDate && createdAt.toDate().getTime() >= desdeMs;
  });
}

// Missões CONCLUÍDAS no total — qualquer missão, não uma específica
// (diferente de 'missao:<id>').
async function contarMissoesConcluidasTotal(uid, desde = null) {
  const q = query(collection(db, 'missionSubmissions'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).length;
}

// Curtidas RECEBIDAS somadas em todos os posts do usuário (soma bruta —
// diferente de 'curtidas_por_post:N', que conta posts que bateram N
// curtidas). Com `desde`, filtra pela data do POST — o Firestore não guarda
// quando cada curtida individual aconteceu, só o array de quem curtiu, então
// uma curtida nova num post antigo não entra no modo "Obtido Durante o
// Período". LIMITAÇÃO CONHECIDA E ACEITA.
async function somarCurtidasRecebidas(uid, desde = null) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).reduce((total, d) => total + (d.data().curtidas || []).length, 0);
}

// Comentários RECEBIDOS somados em todos os posts — soma o
// `comentariosCount` já denormalizado em cada post (incrementado por
// addComment, lib/firestore-helpers.js). Mesma limitação de `desde` que
// somarCurtidasRecebidas (data do POST, não do comentário em si).
async function contarComentariosRecebidosTotal(uid, desde = null) {
  const q = query(collection(db, 'posts'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).reduce((total, d) => total + (d.data().comentariosCount || 0), 0);
}

// Pedidos/Agradecimentos de oração CRIADOS pelo usuário — mesma coleção
// `prayers` de contarComboPedidoEOracoes acima.
async function contarPedidosOracaoCriadosTotal(uid, desde = null) {
  const q = query(collection(db, 'prayers'), where('autorId', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).length;
}

// Pessoas DIFERENTES por quem o usuário já orou — autores distintos entre
// os pointsLog (tipo 'oracao') que tenham o campo `alvoAutorId` preenchido
// (novo, gravado por pontuarOracao em lib/points.js a partir de agora).
// Orações registradas ANTES dessa atualização não têm esse campo e não
// entram na contagem. LIMITAÇÃO CONHECIDA E ACEITA.
async function contarPessoasDiferentesOrou(uid, desde = null) {
  const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
  const snap = await getDocs(q);
  const autores = new Set();
  filtraPorData(snap.docs, desde).forEach((d) => {
    const alvo = d.data().alvoAutorId;
    if (alvo) autores.add(alvo);
  });
  return autores.size;
}

// Dracma recebida/enviada em VALOR total (soma de `valor`) — diferente de
// 'dracma_enviado:qtd'/'dracma_recebido:qtd', que contam QUANTIDADE de
// transferências, não o valor somado.
async function somarDracmaTransferido(uid, direcao, desde = null) {
  const campo = direcao === 'enviada' ? 'origem' : 'destino';
  const q = query(collection(db, 'dracmaLog'), where(campo, '==', uid), where('tipo', '==', 'transferencia'));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).reduce((total, d) => total + (d.data().valor || 0), 0);
}

// Pontos de Comunhão TOTAL — histórico, nunca reduz na virada de temporada
// (diferente de users/{uid}.pontos, zerado por resetarPontosDeTodos() em
// lib/points.js). Soma todo pointsLog, incluindo lançamentos negativos de
// correção (missao_removida/post_removido) — reflete o líquido já ganho na
// vida, corrigindo erros/exclusões em vez de ignorá-los.
async function somarPontosTotal(uid, desde = null) {
  const q = query(collection(db, 'pointsLog'), where('uid', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).reduce((total, d) => total + (d.data().valor || 0), 0);
}

// Dias seguidos no Top 3 / Top 10 do ranking — mesmo padrão de
// lerTop1DiasSeguidos acima, mantidos por lib/rankingStreak.js.
async function lerTop3DiasSeguidos(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.top3DiasSeguidos || 0;
}
async function lerTop10DiasSeguidos(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.top10DiasSeguidos || 0;
}

// Menções feitas/recebidas — contam a coleção `mencoesLog` (gravada por
// addComment em lib/firestore-helpers.js sempre que uma @menção válida
// acontece). Não é um contador denormalizado em users/{uid} de propósito:
// a regra do Firestore só deixa cada pessoa escrever no PRÓPRIO documento
// (ou o Admin, no de qualquer um) — não teria como creditar "menções
// recebidas" na conta de OUTRA pessoa a partir da sessão de quem
// mencionou. Em mencoesLog quem grava é sempre quem mencionou
// (remetenteId == auth.uid, ver firestore.rules), o que funciona pras duas
// pontas. Suporta `desde` de graça, por ser um log de verdade (com
// createdAt) — diferente de um contador de estado.
async function contarMencoesFeitas(uid, desde = null) {
  const q = query(collection(db, 'mencoesLog'), where('remetenteId', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).length;
}
async function contarMencoesRecebidas(uid, desde = null) {
  const q = query(collection(db, 'mencoesLog'), where('mencionadoId', '==', uid));
  const snap = await getDocs(q);
  return filtraPorData(snap.docs, desde).length;
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
  // Conquistas cujo valor pode ter mudado em vários contextos diferentes —
  // mais barato sempre checar de novo do que mapear contexto por contexto.
  if (contadorTipo === 'dracma_saldo') {
    return contexto === 'dracma_ganho' || contexto === 'dracma_enviado' || contexto === 'dracma_recebido';
  }
  if (contadorTipo === 'conquistas_desbloqueadas') return true;
  if (contexto === 'missao_diaria' || contexto === 'leitura') {
    return (
      contadorTipo.startsWith('missao:') ||
      contadorTipo === 'missoes_concluidas_total' ||
      contadorTipo === 'dias_3_oracoes' ||
      contadorTipo === 'madrugada_oracao' ||
      contadorTipo === 'oracao_audio'
    );
  }
  if (contexto === 'oracao') {
    // ATUALIZAÇÃO CONQUISTAS — 'pessoas_diferentes_orou_total' muda quando a
    // PRÓPRIA pessoa ora por alguém (mesmo contexto de 'oracao' de sempre).
    return (
      contadorTipo === 'oracao' ||
      contadorTipo.startsWith('pedido_e_oracoes:') ||
      contadorTipo === 'pessoas_diferentes_orou_total'
    );
  }
  if (contexto === 'pedido_criado') {
    // ATUALIZAÇÃO CONQUISTAS — 'pedido_oracao_criado_total' muda ao criar um
    // pedido/agradecimento (mesmo contexto que já existia pra este combo).
    return contadorTipo.startsWith('pedido_e_oracoes:') || contadorTipo === 'pedido_oracao_criado_total';
  }
  if (contexto === 'post') {
    return contadorTipo === 'post' || contadorTipo.startsWith('categoria:') || contadorTipo.startsWith('categoria_audio_min:');
  }
  if (contexto === 'dracma_ganho') return contadorTipo === 'dracma_ganho_total';
  if (contexto === 'dracma_enviado') {
    // ATUALIZAÇÃO CONQUISTAS — 'dracma_enviado_total' (valor somado, não
    // quantidade) muda no mesmo momento que 'dracma_enviado:qtd'.
    return contadorTipo === 'dracma_enviado:qtd' || contadorTipo === 'dracma_enviado_total';
  }
  if (contexto === 'dracma_recebido') return contadorTipo === 'dracma_recebido:qtd' || contadorTipo === 'dracma_recebido_total';
  if (contexto === 'curtida_recebida') return contadorTipo.startsWith('curtidas_por_post:');
  if (contexto === 'curtida_dada') return contadorTipo === 'curtidas_dadas';
  if (contexto === 'comentario') {
    // ATUALIZAÇÃO CONQUISTAS — 'mencoes_feitas_total' é incrementado no
    // mesmo addComment que já dispara este contexto (quem comenta é quem
    // pode ter mencionado alguém).
    return contadorTipo === 'comentarios' || contadorTipo === 'mencoes_feitas_total';
  }
  if (contexto === 'cadastro') return contadorTipo === 'cadastro';
  if (contexto === 'sessao') {
    return (
      contadorTipo === 'conta_idade_dias' ||
      // Estes também são checados em contextos mais imediatos (ver acima),
      // mas dependem de uma AÇÃO DE OUTRA PESSOA (alguém curtindo seu post,
      // comentando, mencionando você ou te transferindo Dracma) — a regra
      // do Firestore não deixa a sessão de quem agiu conceder conquista pra
      // você, então aqui é o "plano B": pega no próximo login, o mais
      // tardar. BUG CORRIGIDO (já existente antes desta atualização):
      // faltava 'dracma_recebido:qtd' nesta lista.
      contadorTipo.startsWith('curtidas_por_post:') ||
      contadorTipo === 'dracma_saldo' ||
      contadorTipo === 'dracma_recebido:qtd' ||
      // ATUALIZAÇÃO CONQUISTAS — mesmo motivo (dependem de ação de outra
      // pessoa, só dá pra pegar no próximo login dela) mais
      // 'pontos_total', que muda em tantos pontos do app (missão, oração,
      // post, categoria, ajuste do admin...) que é mais barato checar 1x
      // por login do que adicionar uma chamada em cada lugar que credita
      // pontos.
      contadorTipo === 'curtidas_recebidas_total' ||
      contadorTipo === 'comentarios_recebidos_total' ||
      contadorTipo === 'mencoes_recebidas_total' ||
      contadorTipo === 'dracma_recebido_total' ||
      contadorTipo === 'pontos_total'
    );
  }
  if (contexto === 'ranking_top1') {
    // ATUALIZAÇÃO CONQUISTAS — top3/top10 são checados no mesmo momento que
    // top1 (mesma visita à tela de Ranking, ver lib/rankingStreak.js).
    return (
      contadorTipo === 'top1_dias_seguidos' ||
      contadorTipo === 'top3_dias_seguidos' ||
      contadorTipo === 'top10_dias_seguidos'
    );
  }
  return false;
}

/**
 * ATUALIZAÇÃO CONQUISTAS — mesma pergunta de contadorRelevantePara acima,
 * mas para uma conquista com MÚLTIPLOS contadores (campo `contadores`, ver
 * avaliarConquistaMultiContador mais abaixo): é relevante se QUALQUER UM dos
 * contadores dela for relevante pro contexto, ou sempre no contexto
 * 'sessao' — rede de segurança pra conquista que combina contadores de
 * fontes bem diferentes (ex.: uma missão E uma oração) nunca ficar sem
 * checagem nenhuma só por não existir 1 contexto que cubra a combinação
 * inteira.
 */
function contadorRelevanteParaMulti(contadores, contexto) {
  if (contexto === 'sessao') return true;
  return contadores.some((c) => contadorRelevantePara(c.tipo, contexto));
}

/**
 * Calcula o valor atual do contador de uma conquista, de acordo com seu
 * contadorTipo.
 */
async function calcularContador(contadorTipo, uid, streakAtual, dracmaSaldoAtual = null, desde = null) {
  if (contadorTipo === 'streak') {
    return streakAtual;
  }
  if (contadorTipo === 'dracma_saldo') {
    if (dracmaSaldoAtual != null) return dracmaSaldoAtual;
    // Contexto 'sessao' não tem o saldo em mãos (não veio de uma transação
    // de Dracma) — busca direto do documento da pessoa.
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.data()?.dracmas || 0;
  }
  if (contadorTipo === 'dracma_ganho_total') {
    // CORREÇÃO DE BUG (achada na Atualização de Conquistas): os tipos
    // 'ganho_missao'/'ganho_manual' nunca foram gravados em lugar nenhum do
    // dracmaLog — esse contador somava sempre 0. Os tipos realmente
    // gravados por creditarDracma() (lib/dracma.js) são 'categoria' (ganho
    // por ação/categoria configurável) e 'ajuste_admin' (bônus manual do
    // Admin); 'conquista' fica só por compatibilidade com recompensa de
    // conquista já recebida ANTES da mudança de "Receber no Correio"
    // (creditava direto, com esse tipo, na hora do desbloqueio). A partir
    // dessa mudança, tanto recompensa de conquista quanto pontos/dracma
    // enviados pelo Admin pelo Correio são creditados por
    // resgatarRecompensaCorreio() (lib/notificacoes.js), sempre com tipo
    // 'correio' — por isso ele também entra aqui. 'transferencia' fica de
    // fora de propósito (não é "ganho", é recebido de outra pessoa — ver
    // dracma_recebido_total).
    return somarDracmaLog(uid, ['categoria', 'ajuste_admin', 'conquista', 'correio'], desde);
  }
  if (contadorTipo === 'dracma_enviado:qtd') {
    return contarTransferencias(uid, 'enviada');
  }
  if (contadorTipo === 'dracma_recebido:qtd') {
    return contarTransferencias(uid, 'recebida');
  }
  if (contadorTipo === 'dracma_enviado_total') {
    return somarDracmaTransferido(uid, 'enviada', desde);
  }
  if (contadorTipo === 'dracma_recebido_total') {
    return somarDracmaTransferido(uid, 'recebida', desde);
  }
  if (contadorTipo.startsWith('missao:')) {
    const missaoId = contadorTipo.slice('missao:'.length);
    return contarSubmissoes(uid, missaoId, desde);
  }
  if (contadorTipo === 'missoes_concluidas_total') {
    return contarMissoesConcluidasTotal(uid, desde);
  }
  // FASE 2 — conta quantas vezes a pessoa fez uma categoria de ação
  // configurável (ex.: quantas vezes postou usando a categoria "Oração").
  if (contadorTipo.startsWith('categoria:')) {
    const categoriaId = contadorTipo.slice('categoria:'.length);
    return contarAcoesCategoriaTotal(uid, categoriaId, desde);
  }
  // "categoria_audio_min:<categoriaId>:<segundos>" — ex.: "Arautos da
  // Shoppe" (categoria música, áudio de 1+ minuto).
  if (contadorTipo.startsWith('categoria_audio_min:')) {
    const [, categoriaId, segundos] = contadorTipo.split(':');
    return contarPostsCategoriaComAudioMin(uid, categoriaId, Number(segundos) || 0);
  }
  if (contadorTipo === 'oracao') {
    const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
    const snap = await getDocs(q);
    return filtraPorData(snap.docs, desde).length;
  }
  if (contadorTipo === 'post') {
    return contarPosts(uid, desde);
  }
  if (contadorTipo.startsWith('curtidas_por_post:')) {
    const minimo = Number(contadorTipo.split(':')[1]) || 1;
    return contarPostsComCurtidasMin(uid, minimo);
  }
  if (contadorTipo === 'curtidas_dadas') {
    return contarPostsCurtidosPeloUsuario(uid);
  }
  if (contadorTipo === 'curtidas_recebidas_total') {
    return somarCurtidasRecebidas(uid, desde);
  }
  if (contadorTipo === 'comentarios') {
    return contarComentariosDoUsuario(uid);
  }
  if (contadorTipo === 'comentarios_recebidos_total') {
    return contarComentariosRecebidosTotal(uid, desde);
  }
  if (contadorTipo === 'mencoes_feitas_total') {
    return contarMencoesFeitas(uid, desde);
  }
  if (contadorTipo === 'mencoes_recebidas_total') {
    return contarMencoesRecebidas(uid, desde);
  }
  if (contadorTipo === 'dias_3_oracoes') {
    return contarDiasComTresOracoes(uid);
  }
  if (contadorTipo === 'madrugada_oracao') {
    return contarOracoesDeMadrugada(uid);
  }
  if (contadorTipo === 'oracao_audio') {
    return contarOracoesComAudio(uid);
  }
  if (contadorTipo === 'conquistas_desbloqueadas') {
    return contarConquistasDesbloqueadas(uid);
  }
  if (contadorTipo === 'cadastro') {
    return 1; // sempre "verdadeiro" — a conquista dispara na 1ª checagem (contexto 'cadastro')
  }
  if (contadorTipo === 'conta_idade_dias') {
    return calcularIdadeContaEmDias(uid);
  }
  if (contadorTipo.startsWith('pedido_e_oracoes:')) {
    const minimo = Number(contadorTipo.split(':')[1]) || 1;
    return contarComboPedidoEOracoes(uid, minimo);
  }
  if (contadorTipo === 'pedido_oracao_criado_total') {
    return contarPedidosOracaoCriadosTotal(uid, desde);
  }
  if (contadorTipo === 'pessoas_diferentes_orou_total') {
    return contarPessoasDiferentesOrou(uid, desde);
  }
  if (contadorTipo === 'pontos_total') {
    return somarPontosTotal(uid, desde);
  }
  if (contadorTipo === 'top1_dias_seguidos') {
    return lerTop1DiasSeguidos(uid);
  }
  if (contadorTipo === 'top3_dias_seguidos') {
    return lerTop3DiasSeguidos(uid);
  }
  if (contadorTipo === 'top10_dias_seguidos') {
    return lerTop10DiasSeguidos(uid);
  }
  return 0;
}

/**
 * Progresso atual de uma conquista CLÁSSICA (um contadorTipo só), pro
 * contador do pop-up de detalhe (ConquistaDetalheModal) — "quantos a
 * pessoa já fez" sobre "quantos precisa" (conquista.meta), tipo "12/50".
 * Conquistas manuais, sem contadorTipo/meta configurados, OU com múltiplos
 * contadores (campo `contadores` preenchido — ATUALIZAÇÃO CONQUISTAS, ver
 * avaliarConquistaMultiContador abaixo) não têm essa noção simples de
 * progresso — retorna null nesses casos, e o pop-up simplesmente não mostra
 * contador. O valor é sempre travado no máximo em `meta` (mesmo que a
 * pessoa tenha ultrapassado, ex.: streak que já passou da meta de uma
 * conquista antiga), pra nunca mostrar algo tipo "63/50".
 */
export async function getProgressoConquista(conquista, uid) {
  if (
    !conquista?.contadorTipo ||
    conquista.contadorTipo === 'manual' ||
    conquista.meta == null ||
    (Array.isArray(conquista.contadores) && conquista.contadores.length > 0)
  ) {
    return null;
  }
  try {
    const atual = await calcularContador(conquista.contadorTipo, uid);
    return { atual: Math.min(atual, conquista.meta), meta: conquista.meta };
  } catch (err) {
    console.error('Erro ao calcular progresso da conquista:', err);
    return null;
  }
}

/**
 * ATUALIZAÇÃO CONQUISTAS — progresso de uma conquista com MÚLTIPLOS
 * contadores + período de validação, persistido em
 * conquistaProgresso/{uid}_{conquistaId} (ID determinístico, mesmo espírito
 * de achievementsUnlocked). Só existe/é usado por conquista que tenha o
 * campo `contadores` preenchido — conquista clássica nunca cria esse doc.
 */
async function lerProgresso(uid, conquistaId) {
  const snap = await getDoc(doc(db, 'conquistaProgresso', `${uid}_${conquistaId}`));
  if (!snap.exists()) return { janelaInicioEm: null, contagensValidadas: 0 };
  const dados = snap.data();
  return {
    janelaInicioEm: dados.janelaInicioEm?.toDate ? dados.janelaInicioEm.toDate() : null,
    contagensValidadas: dados.contagensValidadas || 0,
  };
}

async function gravarProgresso(uid, conquistaId, { janelaInicioEm, contagensValidadas }) {
  await setDoc(doc(db, 'conquistaProgresso', `${uid}_${conquistaId}`), {
    uid,
    conquistaId,
    janelaInicioEm: janelaInicioEm || null,
    contagensValidadas,
    atualizadoEm: serverTimestamp(),
  });
}

/**
 * ATUALIZAÇÃO CONQUISTAS — avalia uma conquista com múltiplos contadores
 * (campo `contadores`: array de `{ tipo, meta, modo }`). Só entra em ação
 * pra esse tipo de conquista; a clássica (um contadorTipo só) nunca passa
 * por aqui — ver verificarConquistas, que decide qual das duas rotas usar.
 *
 * PRAZO DO PERÍODO DE VALIDAÇÃO (campo `periodoValidacaoDias`) — decisão
 * registrada aqui pra quem for mexer depois: o prazo é PESSOAL, não um
 * relógio único pra todo mundo (tipo virada de dia à meia-noite pra todo
 * mundo junto, como as missões diárias funcionam). Ele começa a contar a
 * partir do momento em que a PRÓPRIA pessoa dá o primeiro passo em direção
 * a essa conquista depois da última tentativa concluída ou expirada — não
 * de uma data fixa definida pelo Admin. Ex.: período de 1 dia, pessoa
 * cumpre a 1ª condição terça às 14h → o prazo dela vale até quarta às 14h,
 * não até a virada do relógio pra quarta.
 *
 * SEM período configurado: checagem simples "todos os contadores batem a
 * meta AGORA?" (equivalente a várias condições de uma conquista clássica,
 * unidas por E) — sem repetição, sem progresso persistido, `meta` da
 * conquista não entra em jogo (não existe "tentativa" pra contar sem um
 * prazo que a delimite).
 *
 * COM período: cada tentativa fica registrada em conquistaProgresso (ver
 * lerProgresso/gravarProgresso acima). Ao completar TODOS os contadores
 * dentro do prazo, conta como 1 "contagem" pra meta da conquista (campo
 * `meta` de sempre — 1 pra combo de fazer uma vez só, mais que isso pra
 * repetir o combo várias vezes, não necessariamente seguidas) e a janela
 * reseta pra uma tentativa nova. Se o prazo vencer sem cumprir todos os
 * contadores, o progresso parcial é descartado (janela reseta do mesmo
 * jeito, mas SEM contar).
 */
async function avaliarConquistaMultiContador(uid, conquista, streakAtual, dracmaSaldoAtual) {
  const criadaEm = conquista.criadaEm?.toDate ? conquista.criadaEm.toDate() : null;
  const temPeriodo = Number(conquista.periodoValidacaoDias) > 0;

  if (!temPeriodo) {
    for (const contador of conquista.contadores) {
      const desde = contador.modo === 'lancamento' ? criadaEm : null;
      // eslint-disable-next-line no-await-in-loop
      const valor = await calcularContador(contador.tipo, uid, streakAtual, dracmaSaldoAtual, desde);
      if (valor < contador.meta) return null;
    }
    if (await desbloquear(uid, conquista)) {
      await notificarConquista(uid, conquista);
      return conquista;
    }
    return null;
  }

  const progresso = await lerProgresso(uid, conquista.id);
  let { janelaInicioEm, contagensValidadas } = progresso;
  const agora = new Date();
  const prazoMs = Number(conquista.periodoValidacaoDias) * 24 * 60 * 60 * 1000;

  if (janelaInicioEm && agora.getTime() - janelaInicioEm.getTime() > prazoMs) {
    // Expirou sem cumprir todos os contadores — descarta o progresso
    // parcial (exatamente como descrito no documento da atualização).
    janelaInicioEm = null;
  }
  if (!janelaInicioEm) janelaInicioEm = agora;

  let todosOk = true;
  for (const contador of conquista.contadores) {
    let desde = null;
    if (contador.modo === 'obtido_periodo') desde = janelaInicioEm;
    else if (contador.modo === 'lancamento') desde = criadaEm;
    // eslint-disable-next-line no-await-in-loop
    const valor = await calcularContador(contador.tipo, uid, streakAtual, dracmaSaldoAtual, desde);
    if (valor < contador.meta) {
      todosOk = false;
      break;
    }
  }

  if (todosOk) {
    contagensValidadas += 1;
    janelaInicioEm = null; // pronta pra uma tentativa nova, se a meta pedir mais de 1 contagem
  }

  await gravarProgresso(uid, conquista.id, { janelaInicioEm, contagensValidadas });

  const metaContagens = conquista.meta || 1;
  if (contagensValidadas >= metaContagens) {
    if (await desbloquear(uid, conquista)) {
      await notificarConquista(uid, conquista);
      return conquista;
    }
  }
  return null;
}

/**
 * Roda as checagens de conquista relevantes para o contexto informado.
 * `contexto` pode ser: 'missao_diaria', 'oracao', 'post', 'leitura', entre
 * outros (ver contadorRelevantePara/contadorRelevanteParaMulti acima).
 * Retorna a lista de conquistas recém-desbloqueadas nesta chamada (para
 * eventualmente mostrar um aviso festivo na tela).
 *
 * Genérico sobre o catálogo de conquistas (vindo do Firestore, ver
 * lib/conquistasRepo.js) — cada conquista automática (contadorTipo !==
 * 'manual') é checada usando seu próprio contadorTipo/meta (conquista
 * clássica) ou seu array `contadores` (ATUALIZAÇÃO CONQUISTAS — múltiplos
 * contadores/período/modo, ver avaliarConquistaMultiContador acima), em vez
 * de um bloco de if escrito à mão por conquista. Isso permite chegar a
 * dezenas de conquistas sem essa função crescer proporcionalmente, e o
 * Admin cria conquista nova sem precisar de mudança de código.
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
    // eslint-disable-next-line no-await-in-loop
    const jaTem = await jaDesbloqueada(uid, conquista.id);
    if (jaTem) continue;

    const multiContador = Array.isArray(conquista.contadores) && conquista.contadores.length > 0;

    if (multiContador) {
      if (!contadorRelevanteParaMulti(conquista.contadores, contexto)) continue;
      // eslint-disable-next-line no-await-in-loop
      const desbloqueada = await avaliarConquistaMultiContador(uid, conquista, streakAtual, dracmaSaldoAtual);
      if (desbloqueada) novas.push(desbloqueada);
      continue;
    }

    if (!contadorRelevantePara(conquista.contadorTipo, contexto)) continue;

    // eslint-disable-next-line no-await-in-loop
    const valorAtual = await calcularContador(conquista.contadorTipo, uid, streakAtual, dracmaSaldoAtual);
    if (valorAtual >= conquista.meta) {
      // eslint-disable-next-line no-await-in-loop
      if (await desbloquear(uid, conquista)) {
        novas.push(conquista);
        // eslint-disable-next-line no-await-in-loop
        await notificarConquista(uid, conquista);
      }
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
      // Usado na busca "por pessoa" da aba Conquistas do Admin, pra mostrar
      // quando a pessoa desbloqueou cada uma.
      desbloqueadoEm: registro?.desbloqueadoEm || null,
    };
  });
}

/**
 * Escolhe até 3 conquistas pra "vitrine" (destaque) do topo do perfil.
 *
 * `usuario.vitrineConquistas` é uma lista de IDs, salva pela própria pessoa
 * em ordem de preferência (ver VitrineConquistasModal). Se ela nunca
 * escolheu nada ainda (campo nem existe no doc), cai num padrão automático:
 * as 3 primeiras conquistas desbloqueadas, na ordem do catálogo (coleção
 * "conquistas" no Firestore, ver lib/conquistasRepo.js) — assim o perfil não
 * fica com a vitrine vazia à toa.
 *
 * Se ela JÁ customizou — inclusive escolhendo mostrar NENHUMA de propósito
 * (array vazio salvo) — respeita exatamente essa escolha. Por isso a
 * checagem é "o campo é um array?" (foi salvo alguma vez) e não "tem
 * tamanho maior que 0?", que não deixaria "nenhuma" ser uma opção real.
 *
 * IDs escolhidos que não estão mais desbloqueados (não deveria acontecer,
 * já que conquista nunca é perdida, mas por segurança) são ignorados.
 */
export function getVitrineConquistas(usuario, conquistas) {
  const desbloqueadas = conquistas.filter((c) => c.desbloqueada);
  const jaCustomizou = Array.isArray(usuario?.vitrineConquistas);

  if (!jaCustomizou) return desbloqueadas.slice(0, 3);

  const porId = {};
  desbloqueadas.forEach((c) => {
    porId[c.id] = c;
  });
  return usuario.vitrineConquistas.map((id) => porId[id]).filter(Boolean).slice(0, 3);
}

/**
 * ATUALIZAÇÃO CONQUISTAS — concede uma conquista "manual" a alguém pelo
 * Admin (painel Conquistas → Aprovar Manualmente). Passa pelo MESMO
 * desbloquear() de uma conquista automática — cadeado, recompensa de
 * Pontos/Dracma configurada, notificação, histórico e contagem pro ranking
 * ficam idênticos; só muda quem/como validou. A regra do Firestore em
 * achievementsUnlocked/pointsLog/dracmaLog já aceita a sessão do Admin
 * gravar isso pra OUTRO uid (ver firestore.rules — bloco isAdmin()).
 *
 * Retorna false se a pessoa já tinha essa conquista (idempotente, mesmo
 * comportamento de desbloquear() — dá pra clicar "Conceder" mais de uma vez
 * sem duplicar nada).
 */
export async function concederConquistaManualmente(uid, achievementId, admin) {
  const conquista = await getConquistaPorId(achievementId);
  if (!conquista) throw new Error('Conquista não encontrada.');

  const concedida = await desbloquear(uid, conquista);
  if (concedida) {
    await notificarConquista(uid, conquista);
    await registrarAcaoAdmin({
      admin,
      acao: 'conceder_conquista_manual',
      alvoTipo: 'conquistas',
      alvoId: achievementId,
      detalhes: conquista.nome || achievementId,
    });
  }
  return concedida;
}
