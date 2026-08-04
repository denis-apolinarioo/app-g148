'use client';

import { useState } from 'react';
import { X, Check } from 'lucide-react';
import EmblemaConquista from '@/components/EmblemaConquista';

const MAXIMO = 3;

/**
 * Escolha da vitrine: toque numa conquista já desbloqueada pra marcar/
 * desmarcar. A ordem em que a pessoa marca vira a ordem de exibição no
 * perfil (primeira marcada = primeira medalha). Trava em 3 escolhidas.
 */
export default function VitrineConquistasModal({ desbloqueadas, selecaoAtual, onFechar, onSalvar }) {
  const [selecionadas, setSelecionadas] = useState(selecaoAtual);
  const [salvando, setSalvando] = useState(false);

  function alternar(id) {
    setSelecionadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= MAXIMO) return atual;
      return [...atual, id];
    });
  }

  async function confirmar() {
    if (salvando) return;
    setSalvando(true);
    try {
      await onSalvar(selecionadas);
    } catch (err) {
      console.error('Erro ao salvar vitrine de conquistas:', err);
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-cream p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-destaque text-lg font-semibold text-coffee-800">Conquistas em destaque</h2>
            <p className="mt-0.5 text-xs text-coffee-400">
              Escolha até {MAXIMO} pra mostrar no seu perfil ({selecionadas.length}/{MAXIMO})
            </p>
          </div>
          <button onClick={onFechar} className="flex-shrink-0 rounded-full p-1.5 text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {desbloqueadas.map((c) => {
            const marcada = selecionadas.includes(c.id);
            const travadaPeloLimite = !marcada && selecionadas.length >= MAXIMO;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => alternar(c.id)}
                disabled={travadaPeloLimite}
                className={`flex flex-col items-center gap-1.5 rounded-xl2 border p-2.5 text-center transition-colors ${
                  marcada ? 'border-gold bg-gold/10' : 'border-coffee-100'
                } ${travadaPeloLimite ? 'opacity-40' : ''}`}
              >
                <div className="relative">
                  <EmblemaConquista conquista={c} size={48} bloqueada={false} mostrarCadeado={false} />
                  {marcada && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-2 ring-cream">
                      <Check size={11} className="text-coffee-900" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p className="font-destaque text-[10px] font-semibold leading-tight text-coffee-600">{c.nome}</p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={confirmar}
          disabled={salvando}
          className="mt-5 w-full rounded-full bg-coffee-800 py-3 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {salvando ? 'Salvando...' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
