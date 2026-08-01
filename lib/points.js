// ============================================================================
// TODA a lógica de pontuação do app passa por aqui. Isso é proposital:
// se um dia a pontuação de alguém parecer errada, o primeiro lugar a olhar
// é este arquivo — a lógica não fica espalhada em cada tela.
//
// Duas proteções importantes contra bug:
// 1) IDs de documento determinísticos (uid_missão_ciclo_n) impedem
//    duplicidade: o Firestore recusa criar um documento que já existe, e a
//    transação varre os "slots" 1..vezesPorPeriodo pra achar um livre —
//    enviar mais vezes do que o permitido no período é fisicamente
//    impossível, não apenas "bloqueado na tela".
// 2) Toda alteração de pontos usa runTransaction, o que evita "race
//    condition" (ex.: dois pontos sendo somados ao mesmo tempo e um deles
//    se perder por causa do tempo de resposta da rede).
//
// MODELO DE PERÍODO: as missões não têm mais periodicidade fixa
// ('diaria'/'semanal'/'mensal') — cada uma define seu próprio ciclo
// (início + duração em dias + repete ou não) e quantas vezes pode ser
// cumprida DENTRO de cada ciclo. Ver lib/missionCycles.js.
// ============================================================================
import {
  doc,
  collection,
  runTransaction,
  serverTimestamp,
  increment,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';
import { PONTOS } from './constants';
import { createPost } from './firestore-helpers';
import { getMissaoPorId } from './missionsRepo';
import { calcularCicloAtual } from './missionCycles';
import { getPontosEfetivosPostarNoFeed, getPontosEfetivosOrarPorAlguem } from './missionOverrides';
import { registrarAcaoAdmin } from './adminLog';

/**
 * Credita pontos para um usuário de forma atômica e registra no pointsLog
 * (histórico auditável de cada ponto ganho). Uso interno — as funções
 * abaixo (submeterMissao, etc.) já chamam isso, você normalmente não
 * precisa chamar diretamente.
 */
async function awardPoints(uid, valor, tipo, descricao, referenciaId = null) {
  const userRef = doc(db, 'users', uid);
  const logRef = doc(collection(db, 'pointsLog')); // gera um ID novo, ainda não grava
  await runTransaction(db, async (transaction) => {
    transaction.update(userRef, { pontos: increment(valor) });
    transaction.set(logRef, {
      uid,
      tipo, // 'missao' | 'oracao' | 'post' | 'streak' | 'desafio'
      valor,
      descricao,
      referenciaId,
      createdAt: serverTimestamp(),
    });
  });
}

/**
 * Item 8º do Bloco 3 — ajuste manual de pontos feito pelo admin (ex.: bônus
 * extra, correção de um erro). Diferente de awardPoints (que grava no
 * pointsLog — o histórico de cada ponto GANHO por missão/oração/post/etc.),
 * um ajuste manual não é "ganho" por uma ação do usuário, então a auditoria
 * vai pro adminActionsLog: o histórico de ações do admin que já existia
 * (lib/adminLog.js), pensado justamente pra este caso ("editar pontos de
 * alguém" já estava no comentário original daquele arquivo).
 *
 * `valor` pode ser positivo (soma) ou negativo (remove). `motivo` é opcional
 * e serve só de anotação pra quem for revisar o histórico depois.
 */
export async function ajustarPontosManualmente(uid, valor, admin, motivo = '') {
  const userRef = doc(db, 'users', uid);
  let pontosAntes = 0;
  let pontosDepois = 0;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    pontosAntes = snap.data()?.pontos || 0;
    pontosDepois = pontosAntes + valor;
    transaction.update(userRef, { pontos: increment(valor) });
  });

  await registrarAcaoAdmin({
    admin,
    acao: 'ajustar_pontos',
    alvoTipo: 'users',
    alvoId: uid,
    valorAntes: pontosAntes,
    valorDepois: pontosDepois,
    detalhes: motivo,
  });

  return pontosDepois;
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
 * Monta a lista ordenada de "itens" que o post automático da missão vai
 * mostrar no feed — usada por components/PostCard.js pra desenhar a
 * hierarquia visual (foto em cima, depois áudio, depois os demais campos
 * na ordem em que o Admin montou a missão).
 *
 * Regras:
 * - foto e áudio vêm sempre primeiro (nessa ordem), só se existirem;
 * - campo do tipo 'check' só entra na lista se a pessoa marcou (true) —
 *   check desmarcado não aparece (não faz sentido mostrar uma pergunta
 *   sem confirmação, como decidido pro Bloco de Feed);
 * - campos de texto/link só entram se tiverem valor preenchido.
 */
function montarItensDeMissao(missao, resposta, fotoURL, audioURL) {
  const itens = [];
  if (fotoURL) itens.push({ tipo: 'foto', url: fotoURL });
  if (audioURL) itens.push({ tipo: 'audio', url: audioURL });

  (missao.campos || []).forEach((campo) => {
    if (campo.tipo === 'check') {
      if (resposta?.[campo.chave] === true) {
        itens.push({ tipo: 'check', label: campo.label });
      }
      return;
    }
    const valor = (resposta?.[campo.chave] || '').toString().trim();
    if (valor) itens.push({ tipo: campo.tipo, label: campo.label, valor });
  });

  return itens;
}

/**
 * Cria o post automático no feed a partir de uma missão cumprida. Se a
 * missão não deixou nada visível pra mostrar (ex.: só tinha campos check e
 * nenhum foi marcado), não cria post nenhum — não faz sentido publicar
 * algo vazio, e a tela de envio (MissionSubmitModal) já impede isso antes
 * de chegar aqui.
 */
async function criarPostDeMissao(missao, autor, resposta, fotoURL, audioURL) {
  const itens = montarItensDeMissao(missao, resposta, fotoURL, audioURL);
  if (itens.length === 0) return;

  // Campos legados (tipo/midiaURL) — mantidos só por compatibilidade com
  // quem ainda lê esses dois campos direto de um post (ex.: o cache local
  // de imagem do PostCard usa `midiaURL`).
  const tipoLegado = fotoURL ? 'foto' : audioURL ? 'audio' : 'texto';
  const midiaLegada = fotoURL || audioURL || '';

  await createPost({
    autor,
    tipo: tipoLegado,
    texto: missao.titulo,
    midiaURL: midiaLegada,
    origemMissaoId: missao.id,
    itens,
  });
}

/**
 * Envia a resposta de uma missão. `resposta` é um objeto com as chaves
 * definidas em `missao.campos` (ex.: { reflexao: '...' }). `fotoURL` e
 * `audioURL` já devem vir prontas (upload feito antes, ver
 * lib/imageCompress.js / lib/storage.js).
 *
 * Lança:
 * - 'MISSAO_FORA_DO_PERIODO' se a missão ainda não começou ou já encerrou
 *   (não deveria acontecer pela tela normal, que já filtra isso — é uma
 *   proteção de segundo nível);
 * - 'MISSAO_LIMITE_ATINGIDO_NO_PERIODO' se `missao.vezesPorPeriodo` já foi
 *   atingido no ciclo atual.
 */
export async function submeterMissao(missaoId, autor, resposta, fotoURL, audioURL) {
  const missao = await getMissaoPorId(missaoId);
  if (!missao) throw new Error('MISSAO_INVALIDA');

  const ciclo = calcularCicloAtual(missao);
  if (!ciclo) throw new Error('MISSAO_FORA_DO_PERIODO');

  const limite = Math.max(1, Number(missao.vezesPorPeriodo) || 1);

  let submissionRef = null;

  // Tentar "criar por cima" de um documento que já existe lança erro — é
  // essa trava que impede passar do limite de envios no ciclo: a transação
  // procura, entre os IDs {uid}_{missaoId}_{cicloId}_1 até
  // {uid}_{missaoId}_{cicloId}_{limite}, o primeiro que ainda não existe.
  await runTransaction(db, async (transaction) => {
    for (let n = 1; n <= limite; n += 1) {
      const candidata = doc(db, 'missionSubmissions', `${autor.uid}_${missaoId}_${ciclo.cicloId}_${n}`);
      // eslint-disable-next-line no-await-in-loop
      const snap = await transaction.get(candidata);
      if (!snap.exists()) {
        submissionRef = candidata;
        break;
      }
    }

    if (!submissionRef) throw new Error('MISSAO_LIMITE_ATINGIDO_NO_PERIODO');

    transaction.set(submissionRef, {
      uid: autor.uid,
      missaoId,
      cicloId: ciclo.cicloId,
      resposta: resposta || {},
      fotoURL: fotoURL || '',
      audioURL: audioURL || '',
      pontosGanhos: missao.pontos,
      createdAt: serverTimestamp(),
    });
  });

  await awardPoints(autor.uid, missao.pontos, 'missao', missao.titulo, submissionRef.id);
  await atualizarStreak(autor.uid);

  if (missao.postaNoFeed) {
    await criarPostDeMissao(missao, autor, resposta, fotoURL, audioURL);
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
