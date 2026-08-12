'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { updatePrayer } from '@/lib/firestore-helpers';
import { todayBrasilia } from '@/lib/dateUtils';

/**
 * Editar um pedido de oração — só texto/prazo (mesmos 2 campos do
 * CreatePrayerModal). A janela de 24h já é checada antes de abrir este
 * modal (ver PrayerCard.js -> podeEditarPedido) e reforçada no
 * firestore.rules (podeEditarConteudoDoPrayer) — aqui só monta os campos e
 * salva.
 */
export default function EditarOracaoModal({ pedido, onFechar }) {
  const [descricao, setDescricao] = useState(pedido.descricao || '');
  const [prazo, setPrazo] = useState(pedido.prazo || '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const minData = todayBrasilia();

  async function handleSalvar() {
    if (!descricao.trim() || !prazo || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      await updatePrayer(pedido.id, { descricao: descricao.trim(), prazo });
      onFechar();
    } catch (err) {
      console.error('Erro ao salvar edição do pedido de oração:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">Editar pedido</h2>
          <button onClick={onFechar} className="text-coffee-400" aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-coffee-500">
              Qual é seu pedido/agradecimento?
            </label>
            <textarea
              rows={4}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-coffee-500">
              Até quando esse pedido fica ativo?
            </label>
            <input
              type="date"
              min={minData}
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="w-full rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800"
            />
          </div>

          {erro && <p className="text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!descricao.trim() || !prazo || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-texto-forte disabled:opacity-50"
          >
            {salvando && <Loader2 size={16} className="animate-spin" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}
