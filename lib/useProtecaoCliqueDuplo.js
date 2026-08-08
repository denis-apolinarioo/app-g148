'use client';

import { useRef, useCallback } from 'react';

const INTERVALO_PADRAO_MS = 600;

// ============================================================================
// Item 17 do Bloco 9 — proteção simples contra clique/toque duplicado em
// curtir, comentar e postar.
// ----------------------------------------------------------------------------
// Os três fluxos já ficam com o botão `disabled` enquanto a ação está em
// andamento (curtindo/enviando/publicando, via useState) — mas dois toques
// bem rápidos podem disparar os dois cliques ANTES do React re-renderizar
// com o botão desabilitado, já que atualização de estado não é instantânea.
// Este hook resolve isso com um controle síncrono (useRef, não depende de
// re-render nenhum): ignora qualquer novo toque que aconteça dentro de
// `intervaloMs` do toque anterior.
//
// Como usar (no topo do handler, antes de qualquer outra coisa):
//   const emDebounce = useProtecaoCliqueDuplo();
//   async function handleCurtir() {
//     if (emDebounce()) return;
//     ...
//   }
// ============================================================================
export function useProtecaoCliqueDuplo(intervaloMs = INTERVALO_PADRAO_MS) {
  const ultimoToqueRef = useRef(0);

  return useCallback(() => {
    const agora = Date.now();
    if (agora - ultimoToqueRef.current < intervaloMs) return true; // ignora — toque duplicado
    ultimoToqueRef.current = agora;
    return false; // segue normalmente
  }, [intervaloMs]);
}
