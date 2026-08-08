// ============================================================================
// FASE 2 — Categorias de ação configuráveis pelo Admin.
// ----------------------------------------------------------------------------
// Mesmo padrão de lib/conquistasRepo.js e lib/missionsRepo.js: o Admin cria,
// edita e apaga categoria direto pelo painel (Admin > Ações > Ações
// específicas), sem precisar de mudança de código. Cada categoria descreve
// uma "ação contável" usada pela Fase 3 (categoria de post no Feed) — ver
// lib/acoesLog.js pra quem realmente credita pontos/Dracma e registra o log
// central.
//
// CAMPOS de cada documento:
//   nome                — nome mostrado no seletor de categoria e no painel Admin
//   ativa               — só categorias ativas aparecem pra escolha no app
//   pontua              — se marcar essa categoria concede Pontos de Comunhão
//   pontos              — quantos pontos (só relevante se pontua === true)
//   daDracma            — se marcar essa categoria concede Dracma
//   dracma              — quanto Dracma (só relevante se daDracma === true)
//   pontosTemLimite     — se existe um teto de quantas vezes ela dá PONTOS
//   pontosLimiteQtd     — quantas vezes, dentro do período (só relevante se
//                         pontosTemLimite === true)
//   pontosLimitePeriodo — 'dia' | 'semana' | 'mes' | 'sempre' (janela em que
//                         pontosLimiteQtd se aplica; 'sempre' = teto vitalício)
//   dracmaTemLimite     — mesma ideia, mas pro teto de DRACMA — TOTALMENTE
//                         independente do limite de pontos (ex.: uma
//                         categoria pode pontuar toda vez mas só dar Dracma
//                         1x por semana, ou vice-versa)
//   dracmaLimiteQtd     — (só relevante se dracmaTemLimite === true)
//   dracmaLimitePeriodo — 'dia' | 'semana' | 'mes' | 'sempre'
//   exigeImagem         — se marcado, só dá pra publicar nessa categoria com
//                         uma foto anexada ao post
//   exigeTexto          — se marcado, o texto/legenda do post não pode ficar
//                         vazio nessa categoria
//   exigeAudio          — se marcado, só dá pra publicar nessa categoria com
//                         um áudio anexado ao post
//   ordem               — ordem de exibição no seletor e no painel Admin
//
// COMPATIBILIDADE — categorias criadas antes desta mudança têm um único par
// `temLimite`/`limiteQtd`/`limitePeriodo` (o mesmo limite valia pra pontos E
// Dracma juntos). normalizarCategoria() abaixo preenche os campos novos a
// partir dos antigos automaticamente na leitura, sem precisar de nenhum
// botão de migração — assim que o Admin salvar a categoria de novo (mesmo
// sem mudar nada), ela já passa a gravar só no formato novo.
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
import { registrarAcaoAdmin } from './adminLog';

const COLECAO = 'categoriasAcao';

function valoresPadrao() {
  return {
    ativa: true,
    pontua: true,
    pontos: 0,
    daDracma: false,
    dracma: 0,
    pontosTemLimite: false,
    pontosLimiteQtd: 1,
    pontosLimitePeriodo: 'sempre',
    dracmaTemLimite: false,
    dracmaLimiteQtd: 1,
    dracmaLimitePeriodo: 'sempre',
    exigeImagem: false,
    exigeTexto: false,
    exigeAudio: false,
  };
}

/**
 * Preenche pontosTemLimite/dracmaTemLimite a partir do antigo campo único
 * temLimite/limiteQtd/limitePeriodo, pra categoria criada antes dessa
 * mudança continuar se comportando exatamente como antes (o limite único
 * valendo pros dois) até o Admin reconfigurar cada um. Não mexe em nada se
 * a categoria já tiver os campos novos.
 */
function normalizarCategoria(dados) {
  const temCamposNovos = dados.pontosTemLimite !== undefined || dados.dracmaTemLimite !== undefined;
  if (temCamposNovos || !dados.temLimite) return dados;

  return {
    ...dados,
    pontosTemLimite: dados.temLimite,
    pontosLimiteQtd: dados.limiteQtd,
    pontosLimitePeriodo: dados.limitePeriodo,
    dracmaTemLimite: dados.temLimite,
    dracmaLimiteQtd: dados.limiteQtd,
    dracmaLimitePeriodo: dados.limitePeriodo,
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
    .map((d) => normalizarCategoria({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export async function getCategoriaAcaoPorId(categoriaId) {
  if (!categoriaId) return null;
  const snap = await getDoc(doc(db, COLECAO, categoriaId));
  return snap.exists() ? normalizarCategoria({ id: snap.id, ...snap.data() }) : null;
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

/**
 * Grava a `ordem` de uma lista inteira de categorias de uma vez só, em
 * lote — usado pela interface de arrastar-e-soltar do painel Admin (mesmo
 * padrão de reordenarMissoes() em lib/missionsRepo.js). Recebe o array já
 * na ordem final desejada (cada item precisa ter pelo menos o campo `id`) e
 * usa o índice de cada item na lista como sua nova `ordem`.
 */
export async function reordenarCategoriasAcao(categoriasNaNovaOrdem) {
  const batch = writeBatch(db);
  categoriasNaNovaOrdem.forEach((categoria, index) => {
    batch.update(doc(db, COLECAO, categoria.id), { ordem: index });
  });
  await batch.commit();
}
