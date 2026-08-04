// ============================================================================
// Fonte única das conquistas — coleção "conquistas" do Firestore. Antes,
// a lista vivia fixa em lib/constants.js (CONQUISTAS); agora o Admin cria,
// edita e apaga conquista direto pelo painel, sem precisar de mim pra cada
// nome/ícone/meta novos. O mesmo padrão de lib/missionsRepo.js foi seguido
// de propósito, pra quem já conhece um reconhecer o outro na hora.
//
// CAMPOS de cada documento:
//   nome        — título mostrado no badge e no modal de detalhe
//   descricao   — texto que aparece quando a pessoa toca na conquista
//   imagemURL   — imagem circular escolhida pelo Admin (opcional)
//   icone       — nome do ícone lucide (kebab-case), usado como fallback
//                 enquanto não houver imagemURL
//   contadorTipo — mesmo formato de sempre: 'streak' | 'oracao' | 'post' |
//                 'missao:<id>' | 'dracma_saldo' | 'dracma_enviado:qtd' |
//                 'dracma_recebido:qtd' | 'dracma_ganho_total' | 'manual'
//   meta        — quantidade necessária (null quando contadorTipo é 'manual')
//   ativa       — só conquistas ativas contam no motor de verificação
//   ordem       — ordem de exibição no catálogo
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
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { slugify } from './slug';
import { CONQUISTAS as CONQUISTAS_SEED_LEGADO } from './constants';
import { CONQUISTAS_NOVAS_SEED } from './seedConquistasNovas';
import { registrarAcaoAdmin } from './adminLog';

const COLECAO = 'conquistas';

function valoresPadrao() {
  return {
    ativa: true,
    imagemURL: '',
    icone: 'award',
  };
}

/**
 * Busca TODAS as conquistas (ativas ou não), já ordenadas pelo campo
 * `ordem`. Mesma observação de escala de getTodasAsMissoes(): a coleção é
 * pequena (dezenas de documentos), então é buscada inteira e filtrada em
 * memória — só vira ponto de atenção se algum dia crescer pra centenas.
 */
export async function getTodasAsConquistas() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export async function getConquistaPorId(conquistaId) {
  const snap = await getDoc(doc(db, COLECAO, conquistaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Cria uma conquista nova. O ID do documento é gerado a partir do nome (ou
 * de idDesejado, se vier) e não muda depois — protege o histórico de
 * achievementsUnlocked, que referencia esse ID.
 */
export async function criarConquista(dados, idDesejado, admin) {
  const todas = await getTodasAsConquistas();
  const idsExistentes = new Set(todas.map((c) => c.id));

  let base = slugify(idDesejado || dados.nome) || 'conquista';
  let idFinal = base;
  let contador = 2;
  while (idsExistentes.has(idFinal)) {
    idFinal = `${base}_${contador}`;
    contador += 1;
  }

  const maiorOrdem = todas.reduce((max, c) => Math.max(max, c.ordem ?? 0), -1);

  await setDoc(doc(db, COLECAO, idFinal), {
    ...valoresPadrao(),
    ...dados,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadaEm: serverTimestamp(),
  });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'criar_conquista',
      alvoTipo: 'conquistas',
      alvoId: idFinal,
      detalhes: dados.nome || idFinal,
    });
  }

  return idFinal;
}

/** Atualiza uma conquista existente. Não aceita mudar o ID. */
export async function atualizarConquista(conquistaId, dados, admin) {
  await updateDoc(doc(db, COLECAO, conquistaId), { ...dados, atualizadaEm: serverTimestamp() });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_conquista',
      alvoTipo: 'conquistas',
      alvoId: conquistaId,
      detalhes: dados.nome || conquistaId,
    });
  }
}

/**
 * Apaga o documento de configuração da conquista. NÃO apaga quem já a
 * desbloqueou (coleção achievementsUnlocked continua intacta) — a pessoa
 * mantém a conquista no histórico dela, só some do catálogo pra quem ainda
 * não tinha.
 */
export async function apagarConquista(conquistaId, admin, nomeConquista) {
  await deleteDoc(doc(db, COLECAO, conquistaId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_conquista',
      alvoTipo: 'conquistas',
      alvoId: conquistaId,
      detalhes: nomeConquista || conquistaId,
    });
  }
}

/**
 * Troca a `ordem` de duas conquistas entre si — usado pelas setinhas de
 * "mover pra cima / pra baixo" no painel Admin.
 */
export async function trocarOrdem(conquistaA, conquistaB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, conquistaA.id), { ordem: conquistaB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, conquistaB.id), { ordem: conquistaA.ordem ?? 0 }),
  ]);
}

/**
 * Grava a `ordem` de uma lista inteira de conquistas de uma vez só, em
 * lote — usado pela interface de arrastar-e-soltar do painel Admin (mesmo
 * padrão de reordenarMissoes() em lib/missionsRepo.js). Recebe o array já
 * na ordem final desejada (cada item precisa ter pelo menos o campo `id`) e
 * usa o índice de cada item na lista como sua nova `ordem`.
 */
export async function reordenarConquistas(conquistasNaNovaOrdem) {
  const batch = writeBatch(db);
  conquistasNaNovaOrdem.forEach((conquista, index) => {
    batch.update(doc(db, COLECAO, conquista.id), { ordem: index });
  });
  await batch.commit();
}

/**
 * MIGRAÇÃO — copia o array fixo de lib/constants.js (CONQUISTAS) pra dentro
 * da coleção "conquistas" do Firestore. Roda a partir de um botão no painel
 * Admin, no mesmo espírito de migrarMissoesDoCodigoParaFirestore(). Segura
 * pra clicar mais de uma vez: só cria os documentos que ainda não existem,
 * nunca sobrescreve uma conquista que o Admin já editou por aqui.
 */
export async function migrarConquistasDoCodigoParaFirestore() {
  const todasFirestore = await getTodasAsConquistas();
  const idsExistentes = new Set(todasFirestore.map((c) => c.id));

  let criadas = 0;
  for (const [indice, conquista] of CONQUISTAS_SEED_LEGADO.entries()) {
    if (idsExistentes.has(conquista.id)) continue; // já migrada — não sobrescreve
    const { id, ...dados } = conquista;
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, COLECAO, id), {
      ...valoresPadrao(),
      ...dados,
      ordem: indice,
      criadaEm: serverTimestamp(),
    });
    criadas += 1;
  }
  return criadas;
}

/**
 * MIGRAÇÃO — mesmo padrão de migrarConquistasDoCodigoParaFirestore(), mas
 * pro seed das "25 conquistas novas" (lib/seedConquistasNovas.js, 20 com
 * níveis I/II/III + 5 únicas = 65 documentos). Também idempotente: rodar de
 * novo só cria o que ainda não existe, nunca sobrescreve edição feita pelo
 * Admin. As novas entram DEPOIS das conquistas já existentes na ordem de
 * exibição (não embaralha o catálogo atual).
 */
export async function migrarConquistasNovasParaFirestore() {
  const todasFirestore = await getTodasAsConquistas();
  const idsExistentes = new Set(todasFirestore.map((c) => c.id));
  let proximaOrdem = todasFirestore.reduce((max, c) => Math.max(max, c.ordem ?? 0), -1) + 1;

  let criadas = 0;
  for (const conquista of CONQUISTAS_NOVAS_SEED) {
    if (idsExistentes.has(conquista.id)) continue; // já migrada — não sobrescreve
    const { id, ...dados } = conquista;
    // eslint-disable-next-line no-await-in-loop
    await setDoc(doc(db, COLECAO, id), {
      ...valoresPadrao(),
      ...dados,
      ordem: proximaOrdem,
      criadaEm: serverTimestamp(),
    });
    proximaOrdem += 1;
    criadas += 1;
  }
  return criadas;
}
