'use client';

import { Loader2 } from 'lucide-react';

// ============================================================================
// Modal de confirmação genérico, no mesmo padrão visual dos outros modais do
// app (rodapé no mobile, canto na tela maior — ver componentes irmãos como
// ConfirmarResetModal.js). Existe pra substituir o antigo `window.confirm()`
// nas ações destrutivas que "trazem prejuízo" (ex.: apagar um post ou uma
// missão devolve/retira os pontos e o Dracma ganhos com eles) — o aviso do
// navegador é seco demais e não deixa destacar isso.
// ============================================================================

export default function ConfirmarAcaoModal({
  titulo,
  mensagem,
  textoConfirmar = 'Confirmar',
  confirmando = false,
  onFechar,
  onConfirmar,
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={() => !confirmando && onFechar?.()}
    >
      <div
        className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-cream p-5 text-center sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-destaque text-base font-semibold text-coffee-800">{titulo}</p>
        <p className="mt-2 text-sm leading-relaxed text-coffee-500">{mensagem}</p>

        <button
          type="button"
          onClick={onConfirmar}
          disabled={confirmando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {confirmando && <Loader2 size={15} className="animate-spin" />}
          {textoConfirmar}
        </button>
        <button
          type="button"
          onClick={onFechar}
          disabled={confirmando}
          className="mt-2 w-full py-1 text-center text-xs text-coffee-400 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
