'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

const ConfirmContext = createContext(null);

// ============================================================================
// Fica montado uma única vez perto da raiz do app (ver app/layout.js) e
// oferece confirmar({...}) via useConfirm() pra qualquer tela — substitui
// window.confirm() no projeto inteiro por um popup próprio (ver
// components/ConfirmDialog.js), sem precisar de state/JSX repetido em cada
// lugar que precisa confirmar uma ação simples.
//
// Uso:
//   const confirmar = useConfirm();
//   const ok = await confirmar({
//     titulo: 'Apagar a missão "X"?',
//     descricao: 'Isso não afeta o histórico já registrado.',
//     perigo: true, // opcional — deixa o ícone/botão em vermelho
//   });
//   if (!ok) return;
//
// `confirmar` sempre resolve pra true (confirmou) ou false (cancelou ou
// clicou fora) — nunca rejeita, então dá pra usar direto num `if (!ok)`.
// ============================================================================
export function ConfirmProvider({ children }) {
  const [opcoes, setOpcoes] = useState(null);
  const resolverRef = useRef(null);

  const confirmar = useCallback((opcoesConfirmacao) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setOpcoes(opcoesConfirmacao || {});
    });
  }, []);

  function responder(valor) {
    setOpcoes(null);
    resolverRef.current?.(valor);
    resolverRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      <ConfirmDialog
        aberto={!!opcoes}
        titulo={opcoes?.titulo}
        descricao={opcoes?.descricao}
        labelConfirmar={opcoes?.labelConfirmar}
        labelCancelar={opcoes?.labelCancelar}
        perigo={opcoes?.perigo}
        onConfirmar={() => responder(true)}
        onCancelar={() => responder(false)}
      />
    </ConfirmContext.Provider>
  );
}

/** Hook pra pedir confirmação — ver exemplo de uso no topo do arquivo. */
export function useConfirm() {
  const confirmar = useContext(ConfirmContext);
  if (!confirmar) {
    throw new Error('useConfirm precisa ser usado dentro de <ConfirmProvider>.');
  }
  return confirmar;
}
