import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
//   createdAt   — quando a ação aconteceu
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
}) {
  await addDoc(collection(db, 'adminActionsLog'), {
    adminId: admin.uid,
    adminNome: admin.nome || '',
    acao,
    alvoTipo,
    alvoId: alvoId || '',
    valorAntes: valorAntes ?? null,
    valorDepois: valorDepois ?? null,
    createdAt: serverTimestamp(),
  });
}
