// ============================================================================
// Fonte única dos Materiais — coleção "materiais" do Firestore. Mesmo
// padrão de lib/conquistasRepo.js e lib/missionsRepo.js: o Admin cria,
// edita, reordena e apaga pelo painel (aba Materiais), sem precisar de
// deploy pra cada item novo.
//
// Pedido do Denis: a "caixa" de Materiais no Perfil (ícone de caixa no
// topo) substitui a ideia antiga de 7 links fixos (Bíblia, Spotify, Drive
// do livro do bimestre, Lição da Escola Sabatina, Curiosidades do
// YouTube, calendário de eventos, Materiais de estudo) — cada um deles
// agora entra aqui como um material do tipo "link", junto com quantos
// outros o Admin quiser (imagem ou PDF também), sem ficar travado num
// número fixo.
//
// CAMPOS de cada documento:
//   nome        — nome mostrado embaixo da capa, na grade de Materiais
//   capaURL     — imagem de capa (corte fixo 1:1, igual às outras imagens
//                 cortadas do app), a mesma pra qualquer tipo de material
//   tipo        — 'imagem' | 'pdf' | 'link' — o que abre quando a pessoa
//                 toca no material
//   conteudoURL — URL do que abre: outra imagem (tela cheia), um PDF
//                 (abre numa aba nova — o navegador já tem leitor de PDF
//                 embutido) ou um link externo (Bíblia, Spotify, Drive,
//                 YouTube etc.)
//   ativo       — só materiais ativos aparecem pra quem não é Admin
//   ordem       — ordem de exibição na grade
//   criadoEm    — gravado automaticamente por criarMaterial() (serverTimestamp)
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

const COLECAO = 'materiais';

function valoresPadrao() {
  return {
    ativo: true,
    capaURL: '',
    tipo: 'link',
    conteudoURL: '',
  };
}

/**
 * Busca TODOS os materiais (ativos ou não), já ordenados pelo campo
 * `ordem`. Mesma observação de escala de getTodasAsConquistas(): a coleção
 * é pequena, buscada inteira e filtrada em memória — só vira ponto de
 * atenção se algum dia crescer pra centenas.
 */
export async function getTodosOsMateriais() {
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

export async function getMaterialPorId(materialId) {
  const snap = await getDoc(doc(db, COLECAO, materialId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/**
 * Cria um material novo. O ID do documento é gerado a partir do nome (não
 * muda depois) — mesmo padrão de criarConquista(), útil pra manter o
 * caminho do Storage (materiais/{id}/...) previsível antes de subir a
 * capa/conteúdo.
 */
export async function criarMaterial(dados, admin) {
  const todos = await getTodosOsMateriais();
  const idsExistentes = new Set(todos.map((m) => m.id));

  let base = slugify(dados.nome) || 'material';
  let idFinal = base;
  let contador = 2;
  while (idsExistentes.has(idFinal)) {
    idFinal = `${base}_${contador}`;
    contador += 1;
  }

  const maiorOrdem = todos.reduce((max, m) => Math.max(max, m.ordem ?? 0), -1);

  await setDoc(doc(db, COLECAO, idFinal), {
    ...valoresPadrao(),
    ...dados,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadoEm: serverTimestamp(),
  });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'criar_material',
      alvoTipo: 'materiais',
      alvoId: idFinal,
      detalhes: dados.nome || idFinal,
    });
  }

  return idFinal;
}

/** Atualiza um material existente. Não aceita mudar o ID. */
export async function atualizarMaterial(materialId, dados, admin) {
  await updateDoc(doc(db, COLECAO, materialId), { ...dados, atualizadoEm: serverTimestamp() });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_material',
      alvoTipo: 'materiais',
      alvoId: materialId,
      detalhes: dados.nome || materialId,
    });
  }
}

/** Apaga o material do catálogo (some da caixa de Materiais pra todo mundo). */
export async function apagarMaterial(materialId, admin, nomeMaterial) {
  await deleteDoc(doc(db, COLECAO, materialId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_material',
      alvoTipo: 'materiais',
      alvoId: materialId,
      detalhes: nomeMaterial || materialId,
    });
  }
}

/**
 * Troca a `ordem` de dois materiais entre si — usado pelas setinhas de
 * mover pra cima/baixo no painel Admin.
 */
export async function trocarOrdem(materialA, materialB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, materialA.id), { ordem: materialB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, materialB.id), { ordem: materialA.ordem ?? 0 }),
  ]);
}

/**
 * Grava a `ordem` de uma lista inteira de materiais de uma vez só, em
 * lote — usado pela interface de arrastar-e-soltar do painel Admin (mesmo
 * padrão de reordenarConquistas() em lib/conquistasRepo.js).
 */
export async function reordenarMateriais(materiaisNaNovaOrdem) {
  const batch = writeBatch(db);
  materiaisNaNovaOrdem.forEach((material, index) => {
    batch.update(doc(db, COLECAO, material.id), { ordem: index });
  });
  await batch.commit();
}
