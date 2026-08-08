'use client';

// ============================================================================
// Item 16 do Bloco 8 — fila de ações offline (curtir post, curtir
// comentário e "Orei por isso").
// ----------------------------------------------------------------------------
// Curtir/orar já são otimistas (lib/useAcaoOtimista.js): a tela muda na hora,
// mesmo sem internet. O que faltava era o que acontece com a chamada de
// verdade ao Firestore quando ela é feita offline — hoje ela ficaria
// pendurada ou falhando, e a ação se perderia se a pessoa fechasse o app
// antes de reconectar.
//
// Agora: se a ação é feita sem internet (usando o mesmo sinal de
// lib/connectivity.js), ela é salva em localStorage — sobrevive a fechar
// o app/recarregar a página — em vez de tentar falar com o Firestore. Assim
// que a conexão volta (evento 'online' do navegador, via aoReconectar), a
// fila é reprocessada sozinha, em ordem, sem a pessoa precisar refazer nada.
//
// Se uma ação demorar pra reprocessar por qualquer outro motivo (erro de
// verdade, não só falta de internet), ela simplesmente fica na fila e tenta
// de novo na próxima vez que a conexão "voltar" — não trava o app nem
// derruba as ações que vieram depois dela na tela (só a ordem de
// processamento é preservada).
// ============================================================================
import { estaOffline, aoReconectar } from './connectivity';
import { toggleLike, toggleCommentLike } from './firestore-helpers';
import { pontuarOracao } from './points';
import { verificarConquistas } from './achievements';

const CHAVE_STORAGE = 'g148_fila_offline';

function lerFila() {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_STORAGE) || '[]');
  } catch {
    return [];
  }
}

function salvarFila(fila) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAVE_STORAGE, JSON.stringify(fila));
  } catch (err) {
    console.error('Não foi possível salvar a fila offline:', err);
  }
}

/**
 * Guarda uma ação (curtidaPost | curtidaComentario | oracao) pra tentar de
 * novo quando a conexão voltar. `payload` só deve ter valores simples
 * (string/número/objeto plano) — nada de Timestamp do Firestore.
 */
export function enfileirarAcaoOffline(tipo, payload) {
  const fila = lerFila();
  fila.push({
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    tipo,
    payload,
    criadoEm: Date.now(),
  });
  salvarFila(fila);
}

async function executarAcao({ tipo, payload }) {
  if (tipo === 'curtidaPost') {
    await toggleLike(payload.postId, payload.uid, payload.jaCurtiu, payload.contexto);
  } else if (tipo === 'curtidaComentario') {
    await toggleCommentLike(payload.postId, payload.commentId, payload.uid, payload.jaCurtiu, {
      remetente: payload.remetente,
      comentarioAutorId: payload.comentarioAutorId,
    });
  } else if (tipo === 'oracao') {
    const orou = await pontuarOracao(payload.uid, payload.prayerId);
    if (orou) {
      await verificarConquistas(payload.uid, payload.streakAtual || 0, 'oracao');
    }
  }
}

let processando = false;

/**
 * Reprocessa a fila em ordem, uma ação de cada vez. Se uma ação falhar de
 * novo, para por ali (as que vierem depois dela esperam a próxima
 * reconexão) — preserva a ordem e nunca pula nem duplica uma ação.
 */
export async function processarFilaOffline() {
  if (processando || estaOffline()) return;
  processando = true;
  try {
    let fila = lerFila();
    while (fila.length > 0) {
      try {
        await executarAcao(fila[0]);
      } catch (err) {
        console.error('Não foi possível reprocessar uma ação da fila offline, tentando de novo mais tarde:', err);
        break;
      }
      fila = fila.slice(1);
      salvarFila(fila);
    }
  } finally {
    processando = false;
  }
}

// Reprocessa sozinha assim que a internet volta.
if (typeof window !== 'undefined') {
  aoReconectar(() => {
    processarFilaOffline();
  });
}
