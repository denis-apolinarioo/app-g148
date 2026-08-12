'use client';

import { useState } from 'react';
import { X, Check, ChevronUp, ChevronDown } from 'lucide-react';
import EmblemaConquista from '@/components/EmblemaConquista';
import { overflowMoldura } from '@/lib/emblemas';

const MAXIMO = 3;
const TAMANHO_SELO = 52;

/**
 * Escolha da vitrine: toque numa conquista já desbloqueada pra marcar/
 * desmarcar (até MAXIMO). A ordem de exibição é livre e fica explícita
 * numa lista embaixo, com setinhas pra mover — em vez de depender da ordem
 * de toque, que ficava confusa ao desmarcar/marcar de novo.
 */
export default function VitrineConquistasModal({ desbloqueadas, selecaoAtual, onFechar, onSalvar }) {
  const [selecionadas, setSelecionadas] = useState(selecaoAtual);
  const [salvando, setSalvando] = useState(false);
  const porId = {};
  desbloqueadas.forEach((c) => {
    porId[c.id] = c;
  });

  function alternar(id) {
    setSelecionadas((atual) => {
      if (atual.includes(id)) return atual.filter((x) => x !== id);
      if (atual.length >= MAXIMO) return atual;
      return [...atual, id];
    });
  }

  function mover(index, direcao) {
    setSelecionadas((atual) => {
      const alvo = index + direcao;
      if (alvo < 0 || alvo >= atual.length) return atual;
      const nova = [...atual];
      [nova[index], nova[alvo]] = [nova[alvo], nova[index]];
      return nova;
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
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
            const espacoParaAnel = overflowMoldura(c.emblema, TAMANHO_SELO);
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
                <div
                  className="relative flex-shrink-0"
                  style={{ width: TAMANHO_SELO, height: TAMANHO_SELO }}
                >
                  <EmblemaConquista conquista={c} size={TAMANHO_SELO} bloqueada={false} />
                  {marcada && (
                    <span className="absolute -right-1 -top-1 z-30 flex h-5 w-5 items-center justify-center rounded-full bg-gold ring-2 ring-cream">
                      <Check size={11} className="text-forte-900" strokeWidth={3} />
                    </span>
                  )}
                </div>
                <p
                  style={{ marginTop: espacoParaAnel > 0 ? Math.round(espacoParaAnel * 0.4) : 0 }}
                  className="font-destaque text-[10px] font-semibold leading-tight text-coffee-600"
                >
                  {c.nome}
                </p>
              </button>
            );
          })}
        </div>

        {selecionadas.length > 0 && (
          <div className="mt-5 border-t border-coffee-100 pt-4">
            <p className="mb-2 text-xs font-medium text-coffee-500">
              Ordem de exibição — use as setinhas pra mudar
            </p>
            <div className="space-y-1.5">
              {selecionadas.map((id, index) => (
                <div
                  key={id}
                  className="flex items-center gap-2 rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-1.5"
                >
                  <span className="flex-1 truncate text-xs font-semibold text-coffee-700">
                    {index + 1}. {porId[id]?.nome}
                  </span>
                  <button
                    type="button"
                    onClick={() => mover(index, -1)}
                    disabled={index === 0}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(index, 1)}
                    disabled={index === selecionadas.length - 1}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-2">
          {selecionadas.length > 0 && (
            <button
              type="button"
              onClick={() => setSelecionadas([])}
              className="flex-shrink-0 rounded-full border border-coffee-100 px-4 py-3 text-xs font-semibold text-coffee-500"
            >
              Não mostrar nenhuma
            </button>
          )}
          <button
            type="button"
            onClick={confirmar}
            disabled={salvando}
            className="flex-1 rounded-full bg-forte-800 py-3 text-sm font-semibold text-texto-forte disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
