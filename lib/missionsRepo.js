// ============================================================================
// Fonte única das missões — coleção "missoes" do Firestore. Isso dá ao
// Admin o poder de criar, editar e apagar missão direto pelo app, sem
// precisar mexer em código nem fazer novo deploy.
//
// MODELO DE PERÍODO (não usa mais periodicidade fixa 'diaria'/'semanal'/
// 'mensal'): cada missão tem `dataInicio` + `duracaoDias` +
// `repeteAutomaticamente` + `vezesPorPeriodo` — ver lib/missionCycles.js
// pra saber como isso vira "qual é o ciclo atual" e "quantas vezes ainda
// dá pra cumprir agora". Esse arquivo só guarda o CRUD do catálogo.
//
// CATEGORIA: cada missão é 'geral' ou 'exclusiva' — usado pra separar a
// tela de Missões em duas seções (ver app/(app)/missoes/page.js).
//
// A coleção é pequena (poucas dezenas de documentos, na prática), então
// buscamos ela inteira de uma vez e filtramos/ordenamos aqui mesmo — isso
// evita precisar criar índice composto no Firestore.
// ============================================================================
import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  serverTimestamp,
  writeBatch,
  query,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { slugify } from './slug';
import { todayBrasilia } from './dateUtils';
import { MISSOES_DIARIAS, MISSOES_SEMANAIS, MISSOES_MENSAIS } from './seedMissoesLegado';
import { registrarAcaoAdmin } from './adminLog';

const COLECAO = 'missoes';

// Duração (em dias) usada pra converter o antigo enum de periodicidade pro
// novo modelo de dias — só usado pelas duas funções de migração abaixo.
const DIAS_POR_PERIODICIDADE_ANTIGA = { diaria: 1, semanal: 7, mensal: 30 };

function valoresPadrao() {
  return {
    ativa: true,
    temaIcone: null,
    destinatarios: null,
    categoria: 'geral', // 'geral' | 'exclusiva'
    repeteAutomaticamente: true,
    vezesPorPeriodo: 1,
  };
}

/**
 * Busca TODAS as missões (qualquer categoria, ativas ou não, já tenham
 * começado ou não), já ordenadas pelo campo `ordem`. Serve de base pras
 * funções abaixo, pra não repetir a mesma leitura em vários lugares do app.
 *
 * NOTA DE ESCALA (registrado no relatório técnico, não é bug — só registro
 * pra quem for mexer aqui depois): essa função busca a coleção `missoes`
 * inteira do Firestore e filtra/ordena tudo em memória, em JS. Isso é ótimo
 * pro cenário atual (dezenas de missões), mas ela é chamada de várias
 * frentes — toda vez que a tela de Missões carrega, toda submissão de
 * missão (pra revalidar título/pontos em lib/points.js) e toda checagem de
 * conquista — então cada uma dessas chamadas rebusca a coleção inteira do
 * zero. Se um dia a lista crescer pra centenas de missões, isso vira um
 * teto de escala (mais leituras do Firestore e mais tempo filtrando em
 * memória a cada chamada). A recomendação, se isso algum dia importar, é
 * paginar a consulta ou cachear o resultado em memória por alguns minutos —
 * não reescrever a função inteira.
 */
export async function getTodasAsMissoes() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/**
 * Missões de uma categoria específica ('geral' | 'exclusiva'). Por padrão
 * só traz as ativas (uso normal, tela de Missões do usuário); passe
 * incluirInativas=true pra listar tudo (uso do painel Admin).
 */
export async function getMissoesPorCategoria(categoria, incluirInativas = false) {
  const todas = await getTodasAsMissoes();
  return todas.filter(
    (m) => (m.categoria || 'geral') === categoria && (incluirInativas || m.ativa !== false)
  );
}

/**
 * Uma missão específica pelo ID. Usado em lib/points.js pra revalidar
 * título/pontos/postaNoFeed no momento do envio, em vez de confiar apenas
 * no que a tela já tinha carregado antes.
 */
export async function getMissaoPorId(missaoId) {
  const snap = await getDoc(doc(db, COLECAO, missaoId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Cria uma missão nova. O ID do documento é gerado a partir do título (ou
 * de idDesejado, se vier) e não pode ser alterado depois — isso protege o
 * histórico de missionSubmissions, que referencia o ID da missão.
 */
export async function criarMissao(dados, idDesejado, admin) {
  const todas = await getTodasAsMissoes();
  const idsExistentes = new Set(todas.map((m) => m.id));

  let base = slugify(idDesejado || dados.titulo) || 'missao';
  let idFinal = base;
  let contador = 2;
  while (idsExistentes.has(idFinal)) {
    idFinal = `${base}_${contador}`;
    contador += 1;
  }

  const maiorOrdem = todas
    .filter((m) => (m.categoria || 'geral') === (dados.categoria || 'geral'))
    .reduce((max, m) => Math.max(max, m.ordem ?? 0), -1);

  await setDoc(doc(db, COLECAO, idFinal), {
    ...valoresPadrao(),
    ...dados,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadaEm: serverTimestamp(),
  });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'criar_missao',
      alvoTipo: 'missoes',
      alvoId: idFinal,
      detalhes: dados.titulo || idFinal,
    });
  }

  return idFinal;
}

/** Atualiza uma missão existente. Não aceita mudar o ID (o Firestore não permite mesmo). */
export async function atualizarMissao(missaoId, dados, admin) {
  await updateDoc(doc(db, COLECAO, missaoId), { ...dados, atualizadaEm: serverTimestamp() });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_missao',
      alvoTipo: 'missoes',
      alvoId: missaoId,
      detalhes: dados.titulo || missaoId,
    });
  }
}

export async function apagarMissao(missaoId, admin, tituloMissao) {
  await deleteDoc(doc(db, COLECAO, missaoId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_missao',
      alvoTipo: 'missoes',
      alvoId: missaoId,
      detalhes: tituloMissao || missaoId,
    });
  }
}

/**
 * Troca a `ordem` de duas missões entre si — usado pelas setinhas de
 * "mover pra cima / pra baixo" no painel Admin, pra reordenar sem precisar
 * abrir o formulário de edição. As duas missões devem ser da mesma
 * categoria (é assim que a tela do Admin já monta os pares).
 */
export async function trocarOrdem(missaoA, missaoB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, missaoA.id), { ordem: missaoB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, missaoB.id), { ordem: missaoA.ordem ?? 0 }),
  ]);
}

/**
 * Grava a `ordem` de uma lista inteira de missões de uma vez só, em lote —
 * base pronta pra uma futura interface de arrastar-e-soltar. Recebe o
 * array já na ordem final desejada (cada item precisa ter pelo menos o
 * campo `id`) e usa o índice de cada item na lista como sua nova `ordem`.
 * Ainda não é chamada por nenhuma tela.
 */
export async function reordenarMissoes(missoesNaNovaOrdem) {
  const batch = writeBatch(db);
  missoesNaNovaOrdem.forEach((missao, index) => {
    batch.update(doc(db, COLECAO, missao.id), { ordem: index });
  });
  await batch.commit();
}

/**
 * Busca todas as submissões de missão de um usuário, já agrupadas por
 * missão (quantas vezes ele cumpriu cada uma e quando foi a última vez) —
 * base da busca "por pessoa" na aba Missões do painel Admin. Cruza com
 * getTodasAsMissoes() pra mostrar o título mesmo de missão já apagada (usa
 * o próprio ID como nome nesse caso, pra não sumir do histórico).
 */
export async function buscarSubmissoesPorUsuario(uid) {
  const [snap, todasMissoes] = await Promise.all([
    getDocs(query(collection(db, 'missionSubmissions'), where('uid', '==', uid))),
    getTodasAsMissoes(),
  ]);
  const missoesPorId = Object.fromEntries(todasMissoes.map((m) => [m.id, m]));

  const porMissao = {};
  snap.docs.forEach((d) => {
    const dados = d.data();
    const chave = dados.missaoId;
    if (!chave) return;
    if (!porMissao[chave]) {
      porMissao[chave] = {
        missaoId: chave,
        titulo: missoesPorId[chave]?.titulo || chave,
        quantidade: 0,
        ultimaData: null,
      };
    }
    porMissao[chave].quantidade += 1;
    const dataAtual = dados.createdAt?.toMillis?.() || 0;
    const dataGuardada = porMissao[chave].ultimaData?.toMillis?.() || 0;
    if (dataAtual >= dataGuardada) porMissao[chave].ultimaData = dados.createdAt;
  });

  return Object.values(porMissao).sort((a, b) => b.quantidade - a.quantidade);
}

/**
 * Converte um objeto de missão que ainda usa o antigo `periodicidade`
 * ('diaria'/'semanal'/'mensal') pro novo modelo de dias. Usado tanto pela
 * migração do seed antigo (migrarMissoesDoCodigoParaFirestore) quanto pela
 * migração de missões que já estavam no Firestore no formato antigo
 * (migrarPeriodicidadeParaCiclos) — pra não duplicar a mesma regra nos dois
 * lugares.
 *
 * `vezesPorPeriodo` sempre sai como 1: o antigo `limiteRepeticoes` era um
 * teto VITALÍCIO (não por período), então não dá pra reaproveitar o número
 * dele como "vezes por período" sem mudar o sentido — 1 é o que reproduz o
 * comportamento de antes (a pessoa só conseguia enviar 1x por dia/semana/mês).
 */
function normalizarParaCiclos(missaoAntiga) {
  const duracaoDias = DIAS_POR_PERIODICIDADE_ANTIGA[missaoAntiga.periodicidade] || 1;
  return {
    dataInicio: todayBrasilia(),
    duracaoDias,
    repeteAutomaticamente: true,
    vezesPorPeriodo: 1,
    categoria: missaoAntiga.categoria || 'geral',
  };
}

/**
 * MIGRAÇÃO — copia o array fixo de lib/constants.js pra dentro da coleção
 * "missoes" do Firestore, já no formato novo de ciclos (dataInicio de hoje,
 * repetindo automaticamente). Roda a partir de um botão no painel Admin
 * (não é script de terminal, porque o projeto não usa Cloud Functions/CLI).
 * Segura pra clicar mais de uma vez: só cria os documentos que ainda não
 * existem — nunca sobrescreve uma missão que o Admin já editou.
 */
export async function migrarMissoesDoCodigoParaFirestore() {
  const todasFirestore = await getTodasAsMissoes();
  const idsExistentes = new Set(todasFirestore.map((m) => m.id));

  const origem = [
    ...MISSOES_DIARIAS.map((m, i) => ({ ...m, periodicidade: 'diaria', ordem: i })),
    ...MISSOES_SEMANAIS.map((m, i) => ({ ...m, periodicidade: 'semanal', ordem: i })),
    ...MISSOES_MENSAIS.map((m, i) => ({ ...m, periodicidade: 'mensal', ordem: i })),
  ];

  let criadas = 0;
  for (const missao of origem) {
    if (idsExistentes.has(missao.id)) continue; // já migrada — não sobrescreve
    const { id, periodicidade, ...dados } = missao;
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, COLECAO, id), {
      ...valoresPadrao(),
      ...dados,
      ...normalizarParaCiclos(missao),
      criadaEm: serverTimestamp(),
    });
    criadas += 1;
  }
  return criadas;
}

/**
 * MIGRAÇÃO — converte missões que já estão no Firestore no formato antigo
 * (`periodicidade: 'diaria'/'semanal'/'mensal'`, sem `duracaoDias`) pro
 * novo modelo de ciclos. Roda a partir de um botão no painel Admin, no
 * mesmo espírito de migrarMissoesDoCodigoParaFirestore(). Segura pra clicar
 * mais de uma vez: só mexe em documentos que ainda tenham `periodicidade` —
 * quem já foi migrado (tem `duracaoDias`) é ignorado.
 */
export async function migrarPeriodicidadeParaCiclos() {
  const todas = await getTodasAsMissoes();

  let migradas = 0;
  for (const missao of todas) {
    if (!missao.periodicidade || missao.duracaoDias) continue; // já migrada — não mexe

    // eslint-disable-next-line no-await-in-loop
    await updateDoc(doc(db, COLECAO, missao.id), {
      ...normalizarParaCiclos(missao),
      periodicidade: deleteField(),
      limiteRepeticoes: deleteField(),
    });
    migradas += 1;
  }
  return migradas;
}

/**
 * MIGRAÇÃO — converte o schema antigo de missão (um `tipo` fixo: check /
 * texto / reflexao / leitura) pro schema novo de composição livre de
 * `campos`, já com `obrigatorio: true` em cada campo (reproduz o
 * comportamento de antes, quando TODO campo era obrigatório pra enviar).
 * Roda a partir de um botão no painel Admin, no mesmo espírito das outras
 * migrações. Segura pra clicar mais de uma vez: só mexe em documentos que
 * ainda tenham o campo antigo `tipo` — quem já foi migrado é ignorado.
 */
export async function migrarCamposDasMissoes() {
  const todas = await getTodasAsMissoes();

  let migradas = 0;
  for (const missao of todas) {
    if (!missao.tipo) continue; // já migrada — não mexe

    let campos;
    let instrucoes = '';

    if (missao.tipo === 'check') {
      campos = [
        { chave: 'confirmacao', label: missao.perguntaConfirmacao || '', tipo: 'check', obrigatorio: true },
      ];
    } else if (missao.tipo === 'texto' || missao.tipo === 'reflexao') {
      campos = (missao.campos || []).map((c) => ({ ...c, obrigatorio: c.obrigatorio ?? true }));
    } else if (missao.tipo === 'leitura') {
      campos = [
        { chave: 'concluido', label: 'Confirmo que terminei a leitura', tipo: 'check', obrigatorio: true },
      ];
      instrucoes = missao.descricao || '';
    } else {
      // tipo desconhecido — não deveria acontecer, mas preserva o que já existir
      campos = (missao.campos || []).map((c) => ({ ...c, obrigatorio: c.obrigatorio ?? true }));
    }

    // eslint-disable-next-line no-await-in-loop
    await updateDoc(doc(db, COLECAO, missao.id), {
      campos,
      permiteFoto: missao.permiteFoto ?? false,
      permiteAudio: false, // nenhuma missão existente tinha áudio ainda
      fotoObrigatoria: false,
      audioObrigatoria: false,
      instrucoes,
      tipo: deleteField(),
      perguntaConfirmacao: deleteField(),
      descricao: deleteField(),
    });
    migradas += 1;
  }
  return migradas;
}
