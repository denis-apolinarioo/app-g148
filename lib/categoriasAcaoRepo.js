// ============================================================================
// FASE 2 — Categorias de ação configuráveis pelo Admin.
// ----------------------------------------------------------------------------
// Mesmo padrão de lib/conquistasRepo.js e lib/missionsRepo.js: o Admin cria,
// edita e apaga categorias direto pelo painel (aba "Categorias"), sem
// precisar de mudança de código. Cada categoria descreve uma "ação contável"
// que hoje é usada pela Fase 3 (categoria de post no Feed) — ver
// lib/acoesLog.js pra quem realmente credita pontos/Dracma e registra o log
// central.
//
// CAMPOS de cada documento:
//   nome          — nome mostrado no seletor de categoria e no painel Admin
//   ativa         — só categorias ativas aparecem pra escolha no app
//   pontua        — se marcar essa categoria concede Pontos de Comunhão
//   pontos        — quantos pontos (só relevante se pontua === true)
//   daDracma      — se marcar essa categoria concede Dracma
//   dracma        — quanto Dracma (só relevante se daDracma === true)
//   temLimite     — se existe um teto de quantas vezes ela pontua/dá Dracma
//   limiteQtd     — quantas vezes, dentro do período (só relevante se
//                   temLimite === true)
//   limitePeriodo — 'dia' | 'semana' | 'mes' | 'sempre' (janela em que
//                   limiteQtd se aplica; 'sempre' = teto vitalício)
//   ordem         — ordem de exibição no seletor e no painel Admin
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
import { slugify } from './slug';
import { registrarAcaoAdmin } from './adminLog';

const COLECAO = 'categoriasAcao';

function valoresPadrao() {
  return {
    ativa: true,
    pontua: true,
    pontos: 0,
    daDracma: false,
    dracma: 0,
    temLimite: false,
    limiteQtd: 1,
    limitePeriodo: 'sempre',
  };
}

/**
 * Busca TODAS as categorias (ativas ou não), já ordenadas pelo campo
 * `ordem`. Coleção pequena (dezenas de documentos) — buscada inteira e
 * ordenada em memória, mesmo padrão de getTodasAsConquistas()/
 * getTodasAsMissoes().
 */
export async function getTodasAsCategoriasAcao() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export async function getCategoriaAcaoPorId(categoriaId) {
  if (!categoriaId) return null;
  const snap = await getDoc(doc(db, COLECAO, categoriaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Cria uma categoria nova. O ID do documento é gerado a partir do nome e não
 * muda depois — protege o histórico de acoesLog, que referencia esse ID.
 */
export async function criarCategoriaAcao(dados, admin) {
  const todas = await getTodasAsCategoriasAcao();
  const idsExistentes = new Set(todas.map((c) => c.id));

  let base = slugify(dados.nome) || 'categoria';
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
      acao: 'criar_categoria_acao',
      alvoTipo: 'categoriasAcao',
      alvoId: idFinal,
      detalhes: dados.nome || idFinal,
    });
  }

  return idFinal;
}

/** Atualiza uma categoria existente. Não aceita mudar o ID. */
export async function atualizarCategoriaAcao(categoriaId, dados, admin) {
  await updateDoc(doc(db, COLECAO, categoriaId), { ...dados, atualizadaEm: serverTimestamp() });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_categoria_acao',
      alvoTipo: 'categoriasAcao',
      alvoId: categoriaId,
      detalhes: dados.nome || categoriaId,
    });
  }
}

/**
 * Apaga o documento de configuração da categoria. NÃO apaga o histórico já
 * gravado em acoesLog — os posts antigos continuam com a pontuação que já
 * receberam, só some do seletor pra novos posts.
 */
export async function apagarCategoriaAcao(categoriaId, admin, nomeCategoria) {
  await deleteDoc(doc(db, COLECAO, categoriaId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_categoria_acao',
      alvoTipo: 'categoriasAcao',
      alvoId: categoriaId,
      detalhes: nomeCategoria || categoriaId,
    });
  }
}

/**
 * Troca a `ordem` de duas categorias entre si — usado pelas setinhas de
 * "mover pra cima / pra baixo" no painel Admin.
 */
export async function trocarOrdemCategoriaAcao(categoriaA, categoriaB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, categoriaA.id), { ordem: categoriaB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, categoriaB.id), { ordem: categoriaA.ordem ?? 0 }),
  ]);
}
