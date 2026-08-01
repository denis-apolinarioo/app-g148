import { addDoc, collection, serverTimestamp, onSnapshot, query, orderBy, limit, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

// ============================================================================
// Item 4 do Bloco A — estrutura base da coleção `adminActionsLog`.
// ----------------------------------------------------------------------------
// Só a base (nome da coleção + formato do documento) — pré-requisito do
// item 11º. Nenhuma ação do painel admin chama isto ainda; cada mudança
// futura (ex.: editar pontos de alguém, apagar uma missão) vai chamar
// registrarAcaoAdmin() no momento em que fizer a alteração de verdade.
//
// Formato do documento:
//   adminId     — uid de quem fez a alteração
//   adminNome   — nome de quem fez a alteração (evita 1 leitura extra pra exibir no histórico)
//   acao        — identificador curto do que foi feito (ex.: 'ajustar_pontos', 'editar_missao')
//   alvoTipo    — coleção/entidade afetada (ex.: 'users', 'missoes')
//   alvoId      — id do documento afetado
//   valorAntes  — valor do campo antes da mudança (formato livre, depende da ação)
//   valorDepois — valor do campo depois da mudança (formato livre, depende da ação)
//   detalhes    — texto livre opcional (ex.: motivo informado pelo admin)
//   createdAt   — quando a ação aconteceu
//
// ATUALIZAÇÃO — Bloco 3 (Auditoria de pontos):
// - Item 8º: lib/points.js chama registrarAcaoAdmin() em
//   ajustarPontosManualmente(), exatamente o caso de uso já previsto acima
//   ("editar pontos de alguém").
// - Item 9º: subscribeToAcoesAdmin() alimenta a nova aba "Histórico" do
//   Admin (app/(app)/admin/_components/AbaHistorico.js).
// ============================================================================

/**
 * Grava uma entrada no histórico auditável de ações do admin. Nunca editável
 * depois de criada (ver regra correspondente em firestore.rules).
 */
export async function registrarAcaoAdmin({
  admin,
  acao,
  alvoTipo,
  alvoId,
  valorAntes,
  valorDepois,
  detalhes,
}) {
  await addDoc(collection(db, 'adminActionsLog'), {
    adminId: admin.uid,
    adminNome: admin.nome || '',
    acao,
    alvoTipo,
    alvoId: alvoId || '',
    valorAntes: valorAntes ?? null,
    valorDepois: valorDepois ?? null,
    detalhes: detalhes || '',
    createdAt: serverTimestamp(),
  });
}

/**
 * Item 9º do Bloco 3 — histórico de ações do admin (mais recentes primeiro),
 * pra tela de auditoria no painel Admin. `quantidade` controla quantos
 * registros vêm (a aba "Recentes" chama de novo com um valor maior a cada
 * clique em "Ver mais", em vez de paginar com cursor — mais simples e
 * suficiente pro volume de ações administrativas).
 */
export function subscribeToAcoesAdmin(callback, quantidade = 15) {
  const q = query(collection(db, 'adminActionsLog'), orderBy('createdAt', 'desc'), limit(quantidade));
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    },
    (err) => {
      console.error('[subscribeToAcoesAdmin] Erro na escuta em tempo real:', err);
    }
  );
}

/**
 * Histórico de ações do admin voltadas a UM usuário específico (aba
 * "Buscar por pessoa" do Histórico). Filtra só por `alvoId` (sem orderBy
 * combinado) de propósito: uma consulta com um único campo de igualdade
 * não exige índice composto no Firestore, então isso funciona sem
 * nenhuma configuração extra no Console. A ordenação (mais recente
 * primeiro) é feita aqui mesmo, no cliente.
 */
export async function buscarAcoesAdminPorUsuario(uid) {
  const q = query(collection(db, 'adminActionsLog'), where('alvoId', '==', uid));
  const snap = await getDocs(q);
  const registros = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  registros.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  return registros;
}
