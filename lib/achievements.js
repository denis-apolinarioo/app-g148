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
import { dateStrBrasilia, horaBrasilia } from './dateUtils';
import { MISSOES_ORACAO_IDS, MADRUGADA_HORA_INICIO, MADRUGADA_HORA_FIM } from './constants';

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
  // Conquistas cujo valor pode ter mudado em vários contextos diferentes —
  // mais barato sempre checar de novo do que mapear contexto por contexto.
  if (contadorTipo === 'dracma_saldo') {
    return contexto === 'dracma_ganho' || contexto === 'dracma_enviado' || contexto === 'dracma_recebido';
  }
  if (contadorTipo === 'conquistas_desbloqueadas') return true;
  if (contexto === 'missao_diaria' || contexto === 'leitura') {
    return (
      contadorTipo.startsWith('missao:') ||
      contadorTipo === 'dias_3_oracoes' ||
      contadorTipo === 'madrugada_oracao' ||
      contadorTipo === 'oracao_audio'
    );
  }
  if (contexto === 'oracao' || contexto === 'pedido_criado') {
    return contadorTipo === 'oracao' || contadorTipo.startsWith('pedido_e_oracoes:');
  }
  if (contexto === 'post') {
    return contadorTipo === 'post' || contadorTipo.startsWith('categoria:') || contadorTipo.startsWith('categoria_audio_min:');
  }
  if (contexto === 'dracma_ganho') return contadorTipo === 'dracma_ganho_total';
  if (contexto === 'dracma_enviado') return contadorTipo === 'dracma_enviado:qtd';
  if (contexto === 'dracma_recebido') return contadorTipo === 'dracma_recebido:qtd';
  if (contexto === 'curtida_recebida') return contadorTipo.startsWith('curtidas_por_post:');
  if (contexto === 'curtida_dada') return contadorTipo === 'curtidas_dadas';
  if (contexto === 'comentario') return contadorTipo === 'comentarios';
  if (contexto === 'cadastro') return contadorTipo === 'cadastro';
  if (contexto === 'sessao') {
    return (
      contadorTipo === 'conta_idade_dias' ||
      // Estes dois também são checados em contextos mais imediatos (ver
      // acima), mas dependem de uma AÇÃO DE OUTRA PESSOA (alguém curtindo
      // seu post / te transferindo Dracma) — a regra do Firestore não deixa
      // a sessão de quem agiu conceder conquista pra você, então aqui é o
      // "plano B": pega no próximo login, o mais tardar.
      // BUG CORRIGIDO: faltava 'dracma_recebido:qtd' nesta lista — uma
      // conquista desse tipo nunca era pega em lugar nenhum (nem aqui, nem
      // em lib/dracma.js -> transferirDracma, que só pode conceder a
      // conquista de quem ENVIOU).
      contadorTipo.startsWith('curtidas_por_post:') ||
      contadorTipo === 'dracma_saldo' ||
      contadorTipo === 'dracma_recebido:qtd'
    );
  }
  if (contexto === 'ranking_top1') return contadorTipo === 'top1_dias_seguidos';
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
    if (dracmaSaldoAtual != null) return dracmaSaldoAtual;
    // Contexto 'sessao' não tem o saldo em mãos (não veio de uma transação
    // de Dracma) — busca direto do documento da pessoa.
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.data()?.dracmas || 0;
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
  // "categoria_audio_min:<categoriaId>:<segundos>" — ex.: "Arautos da
  // Shoppe" (categoria música, áudio de 1+ minuto).
  if (contadorTipo.startsWith('categoria_audio_min:')) {
    const [, categoriaId, segundos] = contadorTipo.split(':');
    return contarPostsCategoriaComAudioMin(uid, categoriaId, Number(segundos) || 0);
  }
  if (contadorTipo === 'oracao') {
    const q = query(collection(db, 'pointsLog'), where('uid', '==', uid), where('tipo', '==', 'oracao'));
    const snap = await getDocs(q);
    return snap.size;
  }
  if (contadorTipo === 'post') {
    return contarPosts(uid);
  }
  if (contadorTipo.startsWith('curtidas_por_post:')) {
    const minimo = Number(contadorTipo.split(':')[1]) || 1;
    return contarPostsComCurtidasMin(uid, minimo);
  }
  if (contadorTipo === 'curtidas_dadas') {
    return contarPostsCurtidosPeloUsuario(uid);
  }
  if (contadorTipo === 'comentarios') {
    return contarComentariosDoUsuario(uid);
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
  if (contadorTipo === 'top1_dias_seguidos') {
    return lerTop1DiasSeguidos(uid);
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
