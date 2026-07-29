// ============================================================================
// Fonte única das missões (diárias, semanais, mensais) — agora vindas da
// coleção "missoes" do Firestore, em vez de fixas em lib/constants.js. Isso
// dá ao Admin o poder de criar, editar e apagar missão direto pelo app, sem
// precisar mexer em código nem fazer novo deploy.
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
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { MISSOES_DIARIAS, MISSOES_SEMANAIS, MISSOES_MENSAIS } from './constants';

const COLECAO = 'missoes';

function slugify(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

function valoresPadrao() {
  // Campos novos reservados pro schema (recurso futuro vai preencher a UI
  // deles depois — por enquanto ficam com valor neutro).
  return {
    ativa: true,
    temaIcone: null,
    limiteRepeticoes: null,
    destinatarios: null,
  };
}

/**
 * Busca TODAS as missões (qualquer periodicidade, ativas ou não), já
 * ordenadas pelo campo `ordem`. Serve de base pras funções abaixo, pra não
 * repetir a mesma leitura em vários lugares do app.
 */
export async function getTodasAsMissoes() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/**
 * Missões de uma periodicidade específica ('diaria' | 'semanal' | 'mensal').
 * Por padrão só traz as ativas (uso normal, tela de Missões do usuário);
 * passe incluirInativas=true pra listar tudo (uso do painel Admin).
 */
export async function getMissoesPorPeriodicidade(periodicidade, incluirInativas = false) {
  const todas = await getTodasAsMissoes();
  return todas.filter(
    (m) => m.periodicidade === periodicidade && (incluirInativas || m.ativa !== false)
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
export async function criarMissao(dados, idDesejado) {
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
    .filter((m) => m.periodicidade === dados.periodicidade)
    .reduce((max, m) => Math.max(max, m.ordem ?? 0), -1);

  await setDoc(doc(db, COLECAO, idFinal), {
    ...valoresPadrao(),
    ...dados,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadaEm: serverTimestamp(),
  });

  return idFinal;
}

/** Atualiza uma missão existente. Não aceita mudar o ID (o Firestore não permite mesmo). */
export async function atualizarMissao(missaoId, dados) {
  await updateDoc(doc(db, COLECAO, missaoId), { ...dados, atualizadaEm: serverTimestamp() });
}

export async function apagarMissao(missaoId) {
  await deleteDoc(doc(db, COLECAO, missaoId));
}

/**
 * Troca a `ordem` de duas missões entre si — usado pelas setinhas de
 * "mover pra cima / pra baixo" no painel Admin, pra reordenar sem precisar
 * abrir o formulário de edição.
 */
export async function trocarOrdem(missaoA, missaoB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, missaoA.id), { ordem: missaoB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, missaoB.id), { ordem: missaoA.ordem ?? 0 }),
  ]);
}

/**
 * MIGRAÇÃO — copia o array fixo de lib/constants.js pra dentro da coleção
 * "missoes" do Firestore. Roda a partir de um botão no painel Admin (não é
 * script de terminal, porque o projeto não usa Cloud Functions/CLI).
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
    const { id, ...dados } = missao;
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, COLECAO, id), {
      ...valoresPadrao(),
      ...dados,
      criadaEm: serverTimestamp(),
    });
    criadas += 1;
  }
  return criadas;
}
