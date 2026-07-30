// ============================================================================
// TODA a lógica de pontuação do app passa por aqui. Isso é proposital:
// se um dia a pontuação de alguém parecer errada, o primeiro lugar a olhar
// é este arquivo — a lógica não fica espalhada em cada tela.
//
// Duas proteções importantes contra bug:
// 1) IDs de documento determinísticos (uid_missão_data) impedem duplicidade:
//    o Firestore recusa criar um documento que já existe, então enviar a
//    mesma missão duas vezes no mesmo dia é fisicamente impossível, não
//    apenas "bloqueado na tela".
// 2) Toda alteração de pontos usa runTransaction, o que evita "race
//    condition" (ex.: dois pontos sendo somados ao mesmo tempo e um deles
//    se perder por causa do tempo de resposta da rede).
//
// ATUALIZAÇÃO: as missões agora vêm da coleção "missoes" do Firestore
// (lib/missionsRepo.js) em vez do array fixo em lib/constants.js. Toda vez
// que uma missão é enviada, este arquivo busca o documento da missão de
// novo (getMissaoPorId) em vez de confiar no que a tela já tinha carregado
// — assim, título/pontos/postaNoFeed usados aqui são sempre os mais atuais.
// ============================================================================
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
  getDoc,
  getDocs,
  query,
  where,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia, currentWeekId, currentMonthId } from './dateUtils';
import { PONTOS } from './constants';
import { createPost } from './firestore-helpers';
import { getMissaoPorId, getMissoesPorPeriodicidade } from './missionsRepo';
import { getPontosEfetivosPostarNoFeed, getPontosEfetivosOrarPorAlguem } from './missionOverrides';

/**
 * Credita pontos para um usuário de forma atômica e registra no pointsLog
 * (histórico auditável de cada ponto ganho). Uso interno — as funções
 * abaixo (submeterMissaoDiaria, etc.) já chamam isso, você normalmente
 * não precisa chamar diretamente.
 */
async function awardPoints(uid, valor, tipo, descricao, referenciaId = null) {
  const userRef = doc(db, 'users', uid);
  const logRef = doc(collection(db, 'pointsLog')); // gera um ID novo, ainda não grava
  await runTransaction(db, async (transaction) => {
    transaction.update(userRef, { pontos: increment(valor) });
    transaction.set(logRef, {
      uid,
      tipo, // 'missao_diaria' | 'missao_semanal' | 'missao_mensal' | 'oracao' | 'post' | 'streak' | 'desafio'
      valor,
      descricao,
      referenciaId,
      createdAt: serverTimestamp(),
    });
  });
}

/**
 * Atualiza a sequência (streak) de dias ativos do usuário. Chamada sempre
 * que qualquer missão é cumprida. Se o último dia ativo foi ontem, soma 1
 * ao streak. Se foi hoje, não faz nada (já contabilizado). Se foi antes de
 * ontem (ou nunca), reinicia o streak em 1.
 */
async function atualizarStreak(uid) {
  const hoje = todayBrasilia();
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) return;
    const dados = snap.data();
    const ultimoDia = dados.ultimoDiaAtivo;

    if (ultimoDia === hoje) return; // já contabilizado hoje, nada a fazer

    const ontem = new Date(`${hoje}T00:00:00-03:00`);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = ontem.toISOString().slice(0, 10);

    const novoStreak = ultimoDia === ontemStr ? (dados.streakAtual || 0) + 1 : 1;
    const novoRecorde = Math.max(novoStreak, dados.streakRecorde || 0);

    transaction.update(userRef, {
      streakAtual: novoStreak,
      streakRecorde: novoRecorde,
      ultimoDiaAtivo: hoje,
    });

    // Bônus de constância: só concede se o streak realmente avançou (não em reinícios)
    if (novoStreak > 1) {
      transaction.update(userRef, { pontos: increment(PONTOS.streakBonusPorDia) });
    }
  });
}

/**
 * Verifica quais missões diárias já foram cumpridas HOJE por um usuário.
 * Retorna um objeto { missaoId: true/false }.
 */
export async function getStatusMissoesDiariasHoje(uid) {
  const hoje = todayBrasilia();
  const missoesDiarias = await getMissoesPorPeriodicidade('diaria');
  const resultados = {};
  await Promise.all(
    missoesDiarias.map(async (missao) => {
      const ref = doc(db, 'missionSubmissions', `${uid}_${missao.id}_${hoje}`);
      const snap = await getDoc(ref);
      resultados[missao.id] = snap.exists();
    })
  );
  return resultados;
}

/**
 * Conta quantas vezes uma pessoa já submeteu uma missão específica, no
 * total (qualquer período). Usado pra aplicar `missao.limiteRepeticoes`
 * quando ele for um número — mesmo padrão de contagem simples já usado em
 * lib/achievements.js (contarSubmissoes).
 */
async function contarSubmissoesMissao(uid, missaoId) {
  const q = query(
    collection(db, 'missionSubmissions'),
    where('uid', '==', uid),
    where('missaoId', '==', missaoId)
  );
  const snap = await getDocs(q);
  return snap.size;
}

/**
 * Monta o texto do post automático a partir das respostas de uma missão:
 * pula os campos do tipo 'check' (guardam true/false, não texto pra
 * mostrar no post) e junta os valores dos campos de texto-curto,
 * texto-longo e link, na ordem em que aparecem em `missao.campos`.
 */
function montarTextoPost(missao, resposta) {
  return (missao.campos || [])
    .filter((c) => c.tipo !== 'check')
    .map((c) => resposta?.[c.chave])
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Decide o tipo/mídia do post automático: áudio tem prioridade sobre foto;
 * se não houver nenhum dos dois, o post é só texto.
 */
function decidirMidiaPost(fotoURL, audioURL) {
  if (audioURL) return { tipo: 'audio', midiaURL: audioURL };
  if (fotoURL) return { tipo: 'foto', midiaURL: fotoURL };
  return { tipo: 'texto', midiaURL: '' };
}

/**
 * Envia a resposta de uma missão diária. `resposta` é um objeto com as
 * chaves definidas em `missao.campos` (ex.: { trecho: '...', reflexao: '...' }).
 * `fotoURL` e `audioURL` já devem vir prontas (upload feito antes, ver
 * lib/imageCompress.js / lib/storage.js).
 *
 * Lança erro 'MISSAO_JA_ENVIADA_HOJE' se a pessoa já enviou essa missão hoje,
 * ou 'MISSAO_LIMITE_ATINGIDO' se `missao.limiteRepeticoes` já foi atingido.
 */
export async function submeterMissaoDiaria(missaoId, autor, resposta, fotoURL, audioURL) {
  const missao = await getMissaoPorId(missaoId);
  if (!missao || missao.periodicidade !== 'diaria') throw new Error('MISSAO_INVALIDA');

  if (typeof missao.limiteRepeticoes === 'number') {
    const totalJaEnviado = await contarSubmissoesMissao(autor.uid, missaoId);
    if (totalJaEnviado >= missao.limiteRepeticoes) {
      throw new Error('MISSAO_LIMITE_ATINGIDO');
    }
  }

  const hoje = todayBrasilia();
  const submissionId = `${autor.uid}_${missaoId}_${hoje}`;
  const submissionRef = doc(db, 'missionSubmissions', submissionId);

  // O próprio Firestore garante que não existam 2 documentos com o mesmo ID.
  // Tentar "criar por cima" de um que já existe lança erro — é essa trava
  // que impede o duplo envio da mesma missão no mesmo dia.
  await runTransaction(db, async (transaction) => {
    const existente = await transaction.get(submissionRef);
    if (existente.exists()) {
      throw new Error('MISSAO_JA_ENVIADA_HOJE');
    }
    transaction.set(submissionRef, {
      uid: autor.uid,
      missaoId,
      tipo: 'diaria',
      data: hoje,
      resposta: resposta || {},
      fotoURL: fotoURL || '',
      audioURL: audioURL || '',
      pontosGanhos: missao.pontos,
      createdAt: serverTimestamp(),
    });
  });

  await awardPoints(autor.uid, missao.pontos, 'missao_diaria', missao.titulo, submissionId);
  await atualizarStreak(autor.uid);

  if (missao.postaNoFeed) {
    const texto = montarTextoPost(missao, resposta);
    const { tipo, midiaURL } = decidirMidiaPost(fotoURL, audioURL);
    await createPost({
      autor,
      tipo,
      texto: `${missao.titulo}\n\n${texto}`,
      midiaURL,
      origemMissaoId: missaoId,
    });
  }

  return true;
}

/**
 * Mesma lógica das diárias, mas para missões semanais (reseta por semana,
 * não por dia — ver lib/dateUtils.js -> currentWeekId).
 */
export async function submeterMissaoSemanal(missaoId, autor, resposta, fotoURL, audioURL) {
  const missao = await getMissaoPorId(missaoId);
  if (!missao || missao.periodicidade !== 'semanal') throw new Error('MISSAO_INVALIDA');

  if (typeof missao.limiteRepeticoes === 'number') {
    const totalJaEnviado = await contarSubmissoesMissao(autor.uid, missaoId);
    if (totalJaEnviado >= missao.limiteRepeticoes) {
      throw new Error('MISSAO_LIMITE_ATINGIDO');
    }
  }

  const semana = currentWeekId();
  const submissionId = `${autor.uid}_${missaoId}_${semana}`;
  const submissionRef = doc(db, 'missionSubmissions', submissionId);

  await runTransaction(db, async (transaction) => {
    const existente = await transaction.get(submissionRef);
    if (existente.exists()) throw new Error('MISSAO_JA_ENVIADA_NESTA_SEMANA');
    transaction.set(submissionRef, {
      uid: autor.uid,
      missaoId,
      tipo: 'semanal',
      data: semana,
      resposta: resposta || {},
      fotoURL: fotoURL || '',
      audioURL: audioURL || '',
      pontosGanhos: missao.pontos,
      createdAt: serverTimestamp(),
    });
  });

  await awardPoints(autor.uid, missao.pontos, 'missao_semanal', missao.titulo, submissionId);
  await atualizarStreak(autor.uid);

  if (missao.postaNoFeed) {
    const texto = montarTextoPost(missao, resposta);
    const { tipo, midiaURL } = decidirMidiaPost(fotoURL, audioURL);
    await createPost({
      autor,
      tipo,
      texto: `${missao.titulo}\n\n${texto}`,
      midiaURL,
      origemMissaoId: missaoId,
    });
  }
  return true;
}

/**
 * Marca uma missão mensal/bimestral (ex.: leitura de livro) como concluída.
 * Aceita a mesma assinatura das missões diária/semanal — missões mensais
 * também podem ter campos (ex.: check de "confirmo que li").
 */
export async function concluirMissaoMensal(missaoId, autor, resposta, fotoURL, audioURL) {
  const missao = await getMissaoPorId(missaoId);
  if (!missao || missao.periodicidade !== 'mensal') throw new Error('MISSAO_INVALIDA');

  if (typeof missao.limiteRepeticoes === 'number') {
    const totalJaEnviado = await contarSubmissoesMissao(autor.uid, missaoId);
    if (totalJaEnviado >= missao.limiteRepeticoes) {
      throw new Error('MISSAO_LIMITE_ATINGIDO');
    }
  }

  const mes = currentMonthId();
  const submissionId = `${autor.uid}_${missaoId}_${mes}`;
  const submissionRef = doc(db, 'missionSubmissions', submissionId);

  await runTransaction(db, async (transaction) => {
    const existente = await transaction.get(submissionRef);
    if (existente.exists()) throw new Error('MISSAO_JA_CONCLUIDA_NESTE_MES');
    transaction.set(submissionRef, {
      uid: autor.uid,
      missaoId,
      tipo: 'mensal',
      data: mes,
      resposta: resposta || {},
      fotoURL: fotoURL || '',
      audioURL: audioURL || '',
      pontosGanhos: missao.pontos,
      createdAt: serverTimestamp(),
    });
  });

  await awardPoints(autor.uid, missao.pontos, 'missao_mensal', missao.titulo, submissionId);

  if (missao.postaNoFeed) {
    const texto = montarTextoPost(missao, resposta);
    const { tipo, midiaURL } = decidirMidiaPost(fotoURL, audioURL);
    await createPost({
      autor,
      tipo,
      texto: `${missao.titulo}\n\n${texto}`,
      midiaURL,
      origemMissaoId: missaoId,
    });
  }

  return true;
}

/**
 * Pontos por postar espontaneamente no feed (fora do fluxo de missões).
 * O valor é configurável pelo Admin (getPontosEfetivosPostarNoFeed). O
 * valor efetivamente usado fica gravado no próprio post (pontosGanhos),
 * pra que, se o post for apagado depois, dê pra remover exatamente esses
 * pontos — mesmo que o Admin mude a pontuação padrão nesse meio tempo.
 */
export async function pontuarPostFeed(uid, postId) {
  const pontosEfetivos = await getPontosEfetivosPostarNoFeed();
  await awardPoints(uid, pontosEfetivos, 'post', 'Post no Feed', postId);
  await updateDoc(doc(db, 'posts', postId), { pontosGanhos: pontosEfetivos });
  return pontosEfetivos;
}

/**
 * Remove os pontos ganhos por um post espontâneo no feed quando ele é
 * apagado (dono ou Admin apagando). Só desconta se o post realmente tinha
 * pontosGanhos gravado (posts vindos de missão não usam esse campo, porque
 * a pontuação deles já é tratada pela missão em si).
 */
export async function removerPontosPost(uid, postId, pontosGanhos) {
  if (!uid || !pontosGanhos) return;
  await awardPoints(uid, -pontosGanhos, 'post_removido', 'Post apagado', postId);
}

/**
 * Pontos por orar pelo pedido de alguém (chamar DEPOIS de
 * registerPrayerInteraction retornar true em firestore-helpers.js).
 */
export async function pontuarOracao(uid, prayerId) {
  const pontosEfetivos = await getPontosEfetivosOrarPorAlguem();
  await awardPoints(uid, pontosEfetivos, 'oracao', 'Orou por um pedido', prayerId);
}

/**
 * Aprovação de desafio individual pelo admin — só quando o admin aprova
 * que os pontos entram, mantendo a regra de "aprovação manual" combinada.
 *
 * BUGFIX: antes esta função apenas dava updateDoc + awardPoints em sequência,
 * sem checar o status atual do desafio. Isso permitia dobrar os pontos se o
 * admin clicasse "Aprovar" duas vezes rápido (o botão não tinha loading) ou
 * se dois admins aprovassem o mesmo desafio da lista ao mesmo tempo. Agora a
 * aprovação roda dentro de uma transação e só credita os pontos se o desafio
 * ainda estiver 'aguardando_aprovacao' — a segunda tentativa é um no-op
 * silencioso, no mesmo padrão de proteção já usado nas missões.
 */
export async function aprovarDesafio(challengeId, uid, pontos) {
  const challengeRef = doc(db, 'challenges', challengeId);
  const logRef = doc(collection(db, 'pointsLog'));
  const userRef = doc(db, 'users', uid);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(challengeRef);
    if (!snap.exists() || snap.data().status !== 'aguardando_aprovacao') {
      // já foi aprovado/rejeitado antes (ou não existe mais) — não credita de novo
      return;
    }
    transaction.update(challengeRef, { status: 'aprovado' });
    transaction.update(userRef, { pontos: increment(pontos) });
    transaction.set(logRef, {
      uid,
      tipo: 'desafio',
      valor: pontos,
      descricao: 'Desafio individual aprovado',
      referenciaId: challengeId,
      createdAt: serverTimestamp(),
    });
  });
}

export async function rejeitarDesafio(challengeId) {
  await updateDoc(doc(db, 'challenges', challengeId), { status: 'rejeitado' });
}
