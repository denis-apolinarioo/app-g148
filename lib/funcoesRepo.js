// ============================================================================
// FUNÇÕES (papéis da comunidade, ex.: "Líder de Célula", "Recepção") —
// mesmo padrão de lib/categoriasAcaoRepo.js / lib/conquistasRepo.js: o Admin
// cria, edita, reordena e apaga pelo painel (aba "Funções"), sem precisar de
// mudança de código.
//
// CAMPOS de cada documento:
//   nome   — nome mostrado no seletor de função (editar perfil) e no Admin
//   ativa  — só funções ativas aparecem pro seletor de quem usa o app;
//            funções inativas continuam valendo pra quem já estava com
//            elas (não muda ninguém à força), só somem da lista de opções
//   ordem  — ordem de exibição no seletor e no painel Admin
//
// TODA pessoa é obrigada a ter uma função (nunca fica sem) — o cadastro
// (lib/firestore-helpers.js -> createUserProfile) já grava 'Membro' por
// padrão, então a seed abaixo garante que 'Membro' sempre exista e esteja
// ativa. A troca de função em si (própria pessoa OU Admin trocando a de
// outra) é feita normalmente pela regra já existente de update de
// users/{uid} — só a troca por OUTRA pessoa (Admin mudando a de alguém)
// precisa do campo `tagFuncao` liberado nas firestore.rules (ver aviso no
// topo da entrega).
// ============================================================================
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { slugify } from './slug';
import { registrarAcaoAdmin } from './adminLog';
import { TAGS_FUNCAO } from './constants';

const COLECAO = 'funcoes';

/**
 * Cria a seed inicial (uma vez só) a partir da antiga lista fixa
 * TAGS_FUNCAO, preservando a ordem — chamada automaticamente por
 * getTodasAsFuncoes()/getFuncoesAtivas() sempre que a coleção ainda está
 * vazia, pra ninguém nunca ficar sem opção de função por a coleção nunca
 * ter sido aberta no Admin.
 */
async function garantirSeed() {
  const snap = await getDocs(collection(db, COLECAO));
  if (!snap.empty) return;

  await Promise.all(
    TAGS_FUNCAO.map((nome, indice) =>
      setDoc(doc(db, COLECAO, slugify(nome) || `funcao_${indice}`), {
        nome,
        ativa: true,
        ordem: indice,
        criadaEm: serverTimestamp(),
      })
    )
  );
}

/**
 * Busca TODAS as funções (ativas ou não), já ordenadas pelo campo `ordem`.
 * Coleção pequena — buscada inteira e ordenada em memória, mesmo padrão de
 * getTodasAsCategoriasAcao()/getTodasAsConquistas().
 */
export async function getTodasAsFuncoes() {
  await garantirSeed();
  const snap = await getDocs(collection(db, COLECAO));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

/** Só as funções ativas — usado no seletor de função (editar perfil). */
export async function getFuncoesAtivas() {
  const todas = await getTodasAsFuncoes();
  return todas.filter((f) => f.ativa !== false);
}

export async function criarFuncao(dados, admin) {
  const todas = await getTodasAsFuncoes();
  const idsExistentes = new Set(todas.map((f) => f.id));

  let base = slugify(dados.nome) || 'funcao';
  let idFinal = base;
  let contador = 2;
  while (idsExistentes.has(idFinal)) {
    idFinal = `${base}_${contador}`;
    contador += 1;
  }

  const maiorOrdem = todas.reduce((max, f) => Math.max(max, f.ordem ?? 0), -1);

  await setDoc(doc(db, COLECAO, idFinal), {
    nome: dados.nome,
    ativa: dados.ativa ?? true,
    ordem: dados.ordem ?? maiorOrdem + 1,
    criadaEm: serverTimestamp(),
  });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'criar_funcao',
      alvoTipo: 'funcoes',
      alvoId: idFinal,
      detalhes: dados.nome || idFinal,
    });
  }

  return idFinal;
}

export async function atualizarFuncao(funcaoId, dados, admin) {
  await updateDoc(doc(db, COLECAO, funcaoId), { ...dados, atualizadaEm: serverTimestamp() });

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'editar_funcao',
      alvoTipo: 'funcoes',
      alvoId: funcaoId,
      detalhes: dados.nome || funcaoId,
    });
  }
}

/**
 * Apaga a função do catálogo. NÃO mexe em quem já estava com essa tag —
 * a pessoa continua com o nome antigo salvo até trocar pra outra função
 * (o seletor só passa a ignorá-la como opção nova).
 */
export async function apagarFuncao(funcaoId, admin, nomeFuncao) {
  await deleteDoc(doc(db, COLECAO, funcaoId));

  if (admin) {
    await registrarAcaoAdmin({
      admin,
      acao: 'excluir_funcao',
      alvoTipo: 'funcoes',
      alvoId: funcaoId,
      detalhes: nomeFuncao || funcaoId,
    });
  }
}

/** Troca a `ordem` de duas funções entre si — setinhas de mover no Admin. */
export async function trocarOrdemFuncao(funcaoA, funcaoB) {
  await Promise.all([
    updateDoc(doc(db, COLECAO, funcaoA.id), { ordem: funcaoB.ordem ?? 0 }),
    updateDoc(doc(db, COLECAO, funcaoB.id), { ordem: funcaoA.ordem ?? 0 }),
  ]);
}
