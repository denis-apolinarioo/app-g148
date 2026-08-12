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
  writeBatch,
  getDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { todayBrasilia } from './dateUtils';
import { PONTOS } from './constants';
import { createPost, getAllUsers, registrarOracao, desfazerOracao } from './firestore-helpers';
import { getMissaoPorId } from './missionsRepo';
import { calcularCicloAtual } from './missionCycles';
import { creditarDracma } from './dracma';
import {
  getPontosEfetivosPostarNoFeed,
  getDracmaEfetivoPostarNoFeed,
  getPontosEfetivosOrarPorAlguem,
  getDracmaEfetivoOrarPorAlguem,
  getPontosEfetivosAbrirVersiculo,
  getDracmaEfetivoAbrirVersiculo,
} from './missionOverrides';
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
 * Cria o post "de bastidor" a partir de uma missão cumprida. Pra missões
 * com postaNoFeed:true isso é o post real, que aparece no Feed pra todo
 * mundo. Pras demais (postaNoFeed:false), é um post com missaoSemFeed:true
 * — Feed/Busca/Perfil ignoram ele (ver app/(app)/feed/page.js,
 * app/(app)/buscar/page.js e components/ProfileView.js) e o PostCard
 * esconde curtida/comentário (ver components/PostCard.js). Ele existe só
 * pra dar pra "encaminhar" (botão no MissionCard) e apagar depois — ver
 * CORREÇÃO DE BUG no fim de submeterMissao, mais abaixo.
 *
 * Se a missão não deixou nada visível pra mostrar (ex.: só tinha campos
 * check e nenhum foi marcado), não cria post nenhum — não faz sentido
 * criar algo vazio, e a tela de envio (MissionSubmitModal) já impede isso
 * antes de chegar aqui.
 */
async function criarPostDeMissao(missao, autor, resposta, fotoURL, audioURL, submissaoId, pontosGanhos, dracmaGanho) {
  const itens = montarItensDeMissao(missao, resposta, fotoURL, audioURL);
  if (itens.length === 0) return null;

  // Campos legados (tipo/midiaURL) — mantidos só por compatibilidade com
  // quem ainda lê esses dois campos direto de um post (ex.: o cache local
  // de imagem do PostCard usa `midiaURL`).
  const tipoLegado = fotoURL ? 'foto' : audioURL ? 'audio' : 'texto';
  const midiaLegada = fotoURL || audioURL || '';

  const postId = await createPost({
    autor,
    tipo: tipoLegado,
    texto: missao.titulo,
    midiaURL: midiaLegada,
    origemMissaoId: missao.id,
    // CORREÇÃO DE BUG: guarda qual submissão (missionSubmissions) gerou
    // este post — é o que permite, ao apagar o post depois, achar de volta
    // a submissão certa pra decidir se libera a missão de novo ou não (ver
    // removerPontosMissaoDoPostApagado).
    origemMissaoSubmissaoId: submissaoId || null,
    itens,
    // CORREÇÃO DE BUG — ver comentário grande no fim de submeterMissao.
    missaoSemFeed: !missao.postaNoFeed,
  });

  // CORREÇÃO DE BUG: post automático de missão não guardava `pontosGanhos`
  // — por isso apagar esse post nunca devolvia os pontos da missão (só o
  // post "espontâneo" no Feed fazia isso). Grava aqui, no mesmo padrão já
  // usado por post com categoria (ver CreatePostSheet.js). Agora também
  // grava `dracmaGanho`, pelo mesmo motivo, já que missão pode dar Dracma.
  if (postId && (pontosGanhos || dracmaGanho)) {
    await updateDoc(doc(db, 'posts', postId), {
      ...(pontosGanhos ? { pontosGanhos } : {}),
      ...(dracmaGanho ? { dracmaGanho } : {}),
    });
  }

  return postId;
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
export async function submeterMissao(missaoId, autor, resposta, fotoURL, audioURL, audioDuracaoSegundos) {
  const missao = await getMissaoPorId(missaoId);
  if (!missao) throw new Error('MISSAO_INVALIDA');

  const ciclo = calcularCicloAtual(missao);
  if (!ciclo) throw new Error('MISSAO_FORA_DO_PERIODO');

  const limite = Math.max(1, Number(missao.vezesPorPeriodo) || 1);

  // Pontos e Dracma efetivos desta missão — mesmo padrão de
  // lib/categoriasAcaoRepo.js (pontua/pontos e daDracma/dracma,
  // independentes um do outro). `pontua` não existia antes desta opção;
  // ausente conta como true, pra missão criada antes continuar pontuando
  // exatamente como antes. `daDracma` ausente conta como false (Dracma é
  // recurso novo, nenhuma missão antiga dava).
  const pontosGanhos = missao.pontua !== false ? Number(missao.pontos) || 0 : 0;
  const dracmaGanho = missao.daDracma ? Number(missao.dracma) || 0 : 0;

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
      // CONQUISTAS NOVAS — duração aproximada (segundos) do áudio enviado,
      // quando houver. Usado por "Paulo no Whatsapp" (áudio orando).
      audioDuracaoSegundos: audioDuracaoSegundos || null,
      pontosGanhos,
      dracmaGanho,
      // Preenchido logo abaixo, depois que o post é criado — permite
      // "encaminhar" desta submissão pro post que ela gerou (ver
      // getSubmissoesDoCicloComPost em lib/missionCycles.js e o botão de
      // atalho em MissionCard.js).
      postId: null,
      createdAt: serverTimestamp(),
    });
  });

  // PERFORMANCE: pontos, dracma, streak e o post automático da missão não
  // dependem um do outro — cada um mexe em campos/documentos separados (o
  // `pontos`/`dracma` usam increment(), que o Firestore resolve de forma
  // atômica mesmo com transações concorrentes no mesmo documento) — então
  // rodam em paralelo em vez de esperar um terminar pra começar o outro.
  // Isso é boa parte do tempo que "enviar missão" ainda levava depois que
  // a submissão em si (a transação acima) já tinha sido salva.
  //
  // CORREÇÃO DE BUG: o botão de "encaminhar" do MissionCard (ícone de
  // seta/voltar no canto do card) leva direto pro post gerado pela missão
  // — mas isso só era criado quando missao.postaNoFeed era true. Numa
  // missão que não posta no Feed, a submissão ficava com postId:null pra
  // sempre, então o botão não tinha pra onde ir: parecia quebrado (o
  // clique não fazia nada, e sem post não tinha como abrir a tela que usa
  // o histórico do navegador pro botão de voltar — ver
  // app/(app)/post/[postId]/page.js). Agora TODA missão cumprida gera um
  // post (ver criarPostDeMissao acima) — a diferença fica só na flag
  // missaoSemFeed, que faz esse post não aparecer em Feed/Busca/Perfil e
  // esconde curtida/comentário nele (ver PostCard.js). Ele existe só pra
  // dar pra "encaminhar" e apagar (o botão de excluir do PostCard já
  // funciona igual pra qualquer post de missão, sem mudança nenhuma).
  const [, , , postId] = await Promise.all([
    pontosGanhos
      ? awardPoints(autor.uid, pontosGanhos, 'missao', missao.titulo, submissionRef.id)
      : Promise.resolve(),
    dracmaGanho
      ? creditarDracma(autor.uid, dracmaGanho, 'missao', missao.titulo, submissionRef.id)
      : Promise.resolve(),
    atualizarStreak(autor.uid),
    criarPostDeMissao(
      missao,
      autor,
      resposta,
      fotoURL,
      audioURL,
      submissionRef.id,
      pontosGanhos,
      dracmaGanho
    ),
  ]);
  if (postId) {
    await updateDoc(submissionRef, { postId });
  }

  return true;
}

/**
 * CORREÇÃO DE BUG — apagar o post automático de uma missão (PostCard.js)
 * não devolvia os pontos ganhos com ela: a pontuação de missão nunca usava
 * o campo `pontosGanhos` do post, então a checagem de removerPontosPost()
 * (que só desconta posts espontâneos) sempre pulava esses posts.
 *
 * Além de descontar os pontos, decide se a missão volta a ficar disponível:
 * - Se a submissão apagada ainda for do CICLO ATUAL da missão (ex.: mesmo
 *   dia, pra uma diária), o "slot" é liberado — a pessoa pode cumprir a
 *   missão de novo, como se nunca tivesse enviado.
 * - Se já virou um ciclo passado (ex.: apagou um dia depois, missão
 *   diária), a submissão NÃO é removida — aquele dia já passou e não tem
 *   como "refazer o passado"; a pessoa só perde os pontos mesmo.
 *
 * `pontosGanhos`/`dracmaGanho` vêm do próprio post (post.pontosGanhos,
 * post.dracmaGanho) — se por acaso vierem vazios (post antigo, de antes
 * desta correção), caem pro valor atual configurado na missão, pra não
 * deixar de descontar nada.
 */
export async function removerPontosMissaoDoPostApagado(uid, missaoId, submissaoId, pontosGanhos, dracmaGanho) {
  if (!uid || !missaoId || !submissaoId) return;

  const missao = await getMissaoPorId(missaoId);
  const valorPontosADescontar = pontosGanhos || (missao?.pontua !== false ? missao?.pontos : 0) || 0;
  const valorDracmaADescontar = dracmaGanho || (missao?.daDracma ? missao?.dracma : 0) || 0;

  if (valorPontosADescontar) {
    await awardPoints(uid, -valorPontosADescontar, 'missao_removida', 'Missão apagada', submissaoId);
  }
  if (valorDracmaADescontar) {
    await creditarDracma(uid, -valorDracmaADescontar, 'missao_removida', 'Missão apagada', submissaoId);
  }

  try {
    const cicloAtual = missao ? calcularCicloAtual(missao) : null;
    if (!cicloAtual) return; // missão não está mais aberta — nada pra liberar

    const submissaoRef = doc(db, 'missionSubmissions', submissaoId);
    const submissaoSnap = await getDoc(submissaoRef);
    if (submissaoSnap.exists() && submissaoSnap.data().cicloId === cicloAtual.cicloId) {
      await deleteDoc(submissaoRef);
    }
  } catch (err) {
    console.error('Erro ao verificar/liberar submissão da missão apagada:', err);
  }
}

/**
 * Pontos (e, se o Admin tiver habilitado, Dracma) por postar
 * espontaneamente no feed (fora do fluxo de missões e sem categoria — ver
 * CreatePostSheet.js). Os valores são configuráveis pelo Admin (aba Ações
 * > Post no Feed). O que foi efetivamente concedido fica gravado no
 * próprio post (pontosGanhos/dracmaGanho), pra que, se o post for apagado
 * depois, dê pra remover exatamente isso — mesmo que o Admin mude a
 * config padrão nesse meio tempo.
 */
export async function pontuarPostFeed(uid, postId) {
  const [pontosEfetivos, dracmaEfetivo] = await Promise.all([
    getPontosEfetivosPostarNoFeed(),
    getDracmaEfetivoPostarNoFeed(),
  ]);
  if (pontosEfetivos > 0) {
    await awardPoints(uid, pontosEfetivos, 'post', 'Post no Feed', postId);
  }
  if (dracmaEfetivo > 0) {
    await creditarDracma(uid, dracmaEfetivo, 'post', 'Post no Feed', postId);
  }
  await updateDoc(doc(db, 'posts', postId), { pontosGanhos: pontosEfetivos, dracmaGanho: dracmaEfetivo });
  return { pontosGanhos: pontosEfetivos, dracmaGanho: dracmaEfetivo };
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
 * Pontos por orar pelo pedido de alguém — registra a interação de hoje
 * (registrarOracao, em firestore-helpers.js) e credita os pontos, os dois
 * já sabendo o ID do pointsLog um do outro (guardado dentro do próprio
 * documento da interação) — é o que permite um desclique depois
 * (desfazerPontosOracao) reverter exatamente esses pontos, nem mais nem
 * menos.
 * Retorna `true` se orou agora, `false` se já tinha orado hoje (não muda
 * nada nesse caso — chamado só se quem chamou ainda não sabe o estado real).
 *
 * ATUALIZAÇÃO CONQUISTAS — também busca o autor do pedido pra gravar
 * `alvoAutorId` no pointsLog, usado pelo contador novo "pessoas diferentes
 * por quem orou" (contarPessoasDiferentesOrou em lib/achievements.js). 1
 * leitura extra, aceitável (não é um caminho quente). Se o pedido já tiver
 * sido apagado nesse meio-tempo, segue sem o campo — só não entra nessa
 * contagem específica, o ponto de orar continua sendo concedido do mesmo
 * jeito.
 */
export async function pontuarOracao(uid, prayerId) {
  const [pontosEfetivos, dracmaEfetivo] = await Promise.all([
    getPontosEfetivosOrarPorAlguem(),
    getDracmaEfetivoOrarPorAlguem(),
  ]);
  const logRef = doc(collection(db, 'pointsLog'));
  const dracmaLogRef = dracmaEfetivo > 0 ? doc(collection(db, 'dracmaLog')) : null;
  const registrou = await registrarOracao(
    prayerId,
    uid,
    pontosEfetivos,
    logRef.id,
    dracmaEfetivo,
    dracmaLogRef?.id || null
  );
  if (!registrou) return false;

  let alvoAutorId = null;
  try {
    const snapPedido = await getDoc(doc(db, 'prayers', prayerId));
    alvoAutorId = snapPedido.data()?.autorId || null;
  } catch (err) {
    console.error('Erro ao buscar autor do pedido pra registrar oração:', err);
  }

  const userRef = doc(db, 'users', uid);
  await runTransaction(db, async (transaction) => {
    transaction.update(userRef, {
      pontos: increment(pontosEfetivos),
      ...(dracmaEfetivo > 0 ? { dracmas: increment(dracmaEfetivo) } : {}),
    });
    transaction.set(logRef, {
      uid,
      tipo: 'oracao',
      valor: pontosEfetivos,
      descricao: 'Orou por um pedido',
      referenciaId: prayerId,
      createdAt: serverTimestamp(),
      ...(alvoAutorId ? { alvoAutorId } : {}),
    });
    if (dracmaLogRef) {
      transaction.set(dracmaLogRef, {
        uid,
        tipo: 'oracao',
        valor: dracmaEfetivo,
        descricao: 'Orou por um pedido',
        referenciaId: prayerId,
        createdAt: serverTimestamp(),
      });
    }
  });
  return true;
}

/**
 * DESCLIQUE — desfaz a oração de hoje pra `prayerId`: some com o registro
 * da interação (desfazerOracao, firestore-helpers.js), tira 1 do contador
 * do pedido, e devolve os pontos ganhos — apagando a entrada do pointsLog
 * correspondente (não somando um estorno), pra que conquistas que contam
 * quantas vezes a pessoa orou (contadorTipo 'oracao', que conta entradas do
 * pointsLog com tipo 'oracao' — ver lib/achievements.js) também descontem
 * certo.
 * Como cada desclique some exatamente com o que o clique anterior tinha
 * criado, alternar clique/desclique várias vezes seguidas nunca deixa mais
 * de 1 oração "valendo" por pedido por dia — não dá pra "farmar" oração
 * clicando repetido.
 * Retorna `true` se desfez algo, `false` se não havia oração hoje pra
 * desfazer.
 */
export async function desfazerPontosOracao(uid, prayerId) {
  const desfeito = await desfazerOracao(prayerId, uid);
  if (!desfeito) return false;

  const { pontosGanhos, pointsLogId, dracmaGanho, dracmaLogId } = desfeito;
  const userRef = doc(db, 'users', uid);
  await runTransaction(db, async (transaction) => {
    if (pontosGanhos || dracmaGanho) {
      transaction.update(userRef, {
        ...(pontosGanhos ? { pontos: increment(-pontosGanhos) } : {}),
        ...(dracmaGanho ? { dracmas: increment(-dracmaGanho) } : {}),
      });
    }
    if (pointsLogId) {
      transaction.delete(doc(db, 'pointsLog', pointsLogId));
    }
    if (dracmaLogId) {
      transaction.delete(doc(db, 'dracmaLog', dracmaLogId));
    }
  });
  return true;
}

/**
 * Pontos (e, se o Admin tiver habilitado, Dracma) por abrir o Verso do Dia
 * (components/VersiculoDiario.js). Só concede na PRIMEIRA abertura de cada
 * dia (fuso Brasília) — abrir de novo no mesmo dia não pontua/dá Dracma de
 * novo; passada a meia-noite (Brasília), libera de novo pro dia seguinte.
 * O controle é o campo `ultimoVersiculoAbertoEm` (formato 'YYYY-MM-DD') em
 * users/{uid}, checado e gravado na MESMA transação que credita a
 * recompensa, pra não haver corrida entre checar e gravar.
 *
 * Retorna { pontosGanhos, dracmaGanho, jaRecebidoHoje } — jaRecebidoHoje
 * indica que a pessoa já tinha resgatado a recompensa de hoje (nesse caso
 * pontosGanhos/dracmaGanho vêm 0, nada é creditado de novo).
 */
export async function pontuarAberturaVersiculo(uid) {
  const hoje = todayBrasilia();
  const userRef = doc(db, 'users', uid);
  const [pontosEfetivos, dracmaEfetivo] = await Promise.all([
    getPontosEfetivosAbrirVersiculo(),
    getDracmaEfetivoAbrirVersiculo(),
  ]);
  const logRef = doc(collection(db, 'pointsLog'));
  const dracmaLogRef = dracmaEfetivo > 0 ? doc(collection(db, 'dracmaLog')) : null;
  let creditou = false;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) return;
    if (snap.data()?.ultimoVersiculoAbertoEm === hoje) return; // já resgatou hoje

    transaction.update(userRef, {
      ...(pontosEfetivos > 0 ? { pontos: increment(pontosEfetivos) } : {}),
      ...(dracmaEfetivo > 0 ? { dracmas: increment(dracmaEfetivo) } : {}),
      ultimoVersiculoAbertoEm: hoje,
    });
    if (pontosEfetivos > 0) {
      transaction.set(logRef, {
        uid,
        tipo: 'versiculo',
        valor: pontosEfetivos,
        descricao: 'Abriu o Verso do Dia',
        referenciaId: null,
        createdAt: serverTimestamp(),
      });
    }
    if (dracmaLogRef) {
      transaction.set(dracmaLogRef, {
        uid,
        tipo: 'versiculo',
        valor: dracmaEfetivo,
        descricao: 'Abriu o Verso do Dia',
        referenciaId: null,
        createdAt: serverTimestamp(),
      });
    }
    creditou = true;
  });

  return creditou
    ? { pontosGanhos: pontosEfetivos, dracmaGanho: dracmaEfetivo, jaRecebidoHoje: false }
    : { pontosGanhos: 0, dracmaGanho: 0, jaRecebidoHoje: true };
}

// (aprovarDesafio / rejeitarDesafio removidas — aba "Desafios" descontinuada)

// ----------------------------------------------------------------------------
// PACOTE 3, item 3.3 — reset manual de Pontos de Comunhão de TODOS os
// usuários. Espelha resetarDracmasDeTodos() em lib/dracma.js (mesmo padrão
// de writeBatch em lotes de 450 + uma única entrada resumida em
// adminActionsLog, sem poluir o pointsLog de cada pessoa com centenas de
// "zeramentos").
// ----------------------------------------------------------------------------
export async function resetarPontosDeTodos(admin) {
  const usuarios = await getAllUsers();
  const afetados = usuarios.filter((u) => (u.pontos || 0) !== 0);

  for (let i = 0; i < afetados.length; i += 450) {
    const lote = afetados.slice(i, i + 450);
    const batch = writeBatch(db);
    lote.forEach((u) => batch.update(doc(db, 'users', u.id), { pontos: 0 }));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }

  await registrarAcaoAdmin({
    admin,
    acao: 'resetar_pontos_todos',
    alvoTipo: 'users',
    alvoId: '',
    valorAntes: null,
    valorDepois: 0,
    detalhes: `${afetados.length} usuário(s) tiveram os Pontos de Comunhão zerados.`,
  });

  return afetados.length;
}
