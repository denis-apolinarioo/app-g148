'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Toast from './Toast';

const ToastContext = createContext(null);

const DURACAO_PADRAO_MS = 2600;

// ============================================================================
// Fica montado uma única vez perto da raiz do app (ver app/layout.js) e
// oferece mostrarToast(mensagem) pra qualquer tela — um aviso leve que
// aparece por alguns segundos e some sozinho, sem travar nada. Pensado pro
// "sucesso silencioso" de uma ação que JÁ terminou de verdade (ex.: publicar
// no Feed — ver CreatePostSheet.js, ou enviar uma missão — ver
// MissionSubmitModal.js): a tela já fecha/segue em frente, isso aqui é só a
// confirmação visual, no mesmo espírito do useConfirm() (ConfirmProvider.js).
//
// Uso:
//   const mostrarToast = useToast();
//   mostrarToast('Publicado com sucesso!');
// ============================================================================
export function ToastProvider({ children }) {
  const [mensagem, setMensagem] = useState('');
  const timeoutRef = useRef(null);

  const mostrarToast = useCallback((texto, duracaoMs = DURACAO_PADRAO_MS) => {
    clearTimeout(timeoutRef.current);
    setMensagem(texto);
    timeoutRef.current = setTimeout(() => setMensagem(''), duracaoMs);
  }, []);

  return (
    <ToastContext.Provider value={mostrarToast}>
      {children}
      <Toast mensagem={mensagem} />
    </ToastContext.Provider>
  );
}

/** Hook pra disparar um toast leve — ver exemplo de uso no topo do arquivo. */
export function useToast() {
  const mostrarToast = useContext(ToastContext);
  if (!mostrarToast) {
    throw new Error('useToast precisa ser usado dentro de <ToastProvider>.');
  }
  return mostrarToast;
}
