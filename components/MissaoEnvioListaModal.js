'use client';

import { CornerUpRight } from 'lucide-react';
import { formatDateTimeBR } from '@/lib/dateUtils';

// ============================================================================
// Aberto pelo botãozinho de "encaminhar" no canto do MissionCard, só quando a
// missão já foi cumprida MAIS DE UMA VEZ no período atual (uma vez só, o
// próprio card já leva direto pro post, sem precisar deste passo). Lista do
// mais recente pro mais antigo — mesmo espírito visual do ConfirmDialog.
// ============================================================================
export default function MissaoEnvioListaModal({ titulo, submissoes, onEscolher, onFechar }) {
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-forte-900/50 p-5"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-xs rounded-2xl bg-cream-card p-5 shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-center font-destaque text-base font-semibold text-coffee-800">{titulo}</p>
        <p className="mt-1 text-center text-xs text-coffee-400">Qual envio você quer ver?</p>

        <div className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
          {submissoes.map((submissao, indice) => (
            <button
              key={submissao.id}
              onClick={() => onEscolher(submissao)}
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-coffee-100 bg-cream px-3.5 py-2.5 text-left active:bg-coffee-50"
            >
              <span className="text-sm text-coffee-700">
                {submissao.createdAt?.toDate ? formatDateTimeBR(submissao.createdAt) : `Envio ${indice + 1}`}
              </span>
              <CornerUpRight size={15} className="flex-shrink-0 text-coffee-300" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onFechar}
          className="mt-4 w-full text-center text-xs text-coffee-400"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
