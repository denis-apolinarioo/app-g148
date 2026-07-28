'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createPrayer } from '@/lib/firestore-helpers';
import { todayBrasilia } from '@/lib/dateUtils';

export default function CreatePrayerModal({ onFechar, onCriado }) {
  const { perfil } = useAuth();
  const [descricao, setDescricao] = useState('');
  const [prazo, setPrazo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const minData = todayBrasilia();

  async function handleEnviar() {
    if (!descricao.trim() || !prazo || enviando) return;
    setEnviando(true);
    setErro('');
    try {
      await createPrayer(perfil, descricao.trim(), prazo);
      onCriado?.();
      onFechar();
    } catch (err) {
      console.error('Erro ao criar pedido de oração:', err);
      setErro('Não foi possível enviar agora. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">Pedido ou agradecimento</h2>
          <button onClick={onFechar} className="text-coffee-400">
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
              placeholder="Compartilhe o que está no seu coração..."
              className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800 placeholder:text-coffee-300"
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

          <p className="text-xs text-coffee-300">
            Esse pedido ficará visível pra toda a comunidade poder orar com você.
          </p>

          {erro && <p className="text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleEnviar}
            disabled={!descricao.trim() || !prazo || enviando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {enviando && <Loader2 size={16} className="animate-spin" />}
            Publicar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
