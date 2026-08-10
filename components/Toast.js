'use client';

import { CheckCircle2 } from 'lucide-react';

// ============================================================================
// Aviso leve que aparece no rodapé da tela, por cima de tudo, e some
// sozinho — usado pra confirmar um "sucesso silencioso" (ex.: publicar no
// Feed, enviar uma missão): a ação já aconteceu de verdade, isso aqui é só
// a confirmação visual, sem pedir nada de volta. Renderizado uma única vez
// por ToastProvider.js — ver lá o hook useToast() pra disparar.
// ============================================================================
export default function Toast({ mensagem }) {
  if (!mensagem) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[90] flex justify-center px-5">
      <div
        role="status"
        className="pointer-events-auto flex max-w-[85vw] items-center gap-2 rounded-full bg-coffee-800 px-4 py-2.5 text-sm font-medium text-cream shadow-lg animate-popupFlutuante"
      >
        <CheckCircle2 size={16} className="flex-shrink-0" />
        <span className="truncate">{mensagem}</span>
      </div>
    </div>
  );
}
