'use client';

import { Loader2, ShieldAlert, HelpCircle } from 'lucide-react';

// ============================================================================
// Popup de confirmação padrão do app — substitui window.confirm() (que tem
// visual feio/fora do padrão e não é confiável em todo navegador/PWA
// instalado) por um componente próprio, flutuante e centralizado, no mesmo
// estilo visual dos outros modais do app.
//
// Fecha ao clicar fora, como pedido pra todos os pop ups do projeto —
// clicar fora equivale a "Cancelar" (nunca confirma a ação sozinho).
//
// Uso normal: através do hook useConfirm() (ver components/ConfirmProvider.js),
// que já cuida de mostrar/esconder isso a partir de uma chamada simples:
//
//   const confirmar = useConfirm();
//   async function handleApagar() {
//     const ok = await confirmar({ titulo: 'Apagar X?', descricao: '...', perigo: true });
//     if (!ok) return;
//     ...
//   }
//
// Este componente também pode ser usado direto (controlado), se algum dia
// precisar de um caso fora do fluxo padrão do ConfirmProvider.
// ============================================================================
export default function ConfirmDialog({
  aberto,
  titulo = 'Tem certeza?',
  descricao = '',
  labelConfirmar = 'Confirmar',
  labelCancelar = 'Cancelar',
  perigo = false,
  confirmando = false,
  onConfirmar,
  onCancelar,
}) {
  if (!aberto) return null;

  const Icone = perigo ? ShieldAlert : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-forte-900/50 p-5"
      onClick={onCancelar}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-cream-card p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
            perigo ? 'bg-red-50' : 'bg-coffee-50'
          }`}
        >
          <Icone size={20} className={perigo ? 'text-red-600' : 'text-coffee-600'} />
        </div>

        <p className="mt-3 text-center font-destaque text-base font-semibold text-coffee-800">
          {titulo}
        </p>
        {descricao && <p className="mt-1 text-center text-sm text-coffee-400">{descricao}</p>}

        <button
          type="button"
          onClick={onConfirmar}
          disabled={confirmando}
          className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-cream disabled:opacity-60 ${
            perigo ? 'bg-red-700' : 'bg-forte'
          }`}
        >
          {confirmando && <Loader2 size={15} className="animate-spin" />}
          {labelConfirmar}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={confirmando}
          className="mt-2 w-full text-center text-xs text-coffee-400 disabled:opacity-60"
        >
          {labelCancelar}
        </button>
      </div>
    </div>
  );
}
