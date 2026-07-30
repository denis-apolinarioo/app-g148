'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { getAllUsers, createChallenge, subscribeToPendingChallenges } from '@/lib/firestore-helpers';
import { aprovarDesafio, rejeitarDesafio } from '@/lib/points';

export default function AbaDesafios() {
  const [pendentes, setPendentes] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [criando, setCriando] = useState(false);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState(50);
  const [enviando, setEnviando] = useState(false);
  // BUGFIX: os botões Aprovar/Rejeitar não tinham nenhum estado de "processando",
  // então dava pra clicar várias vezes rápido e disparar aprovarDesafio() mais de
  // uma vez pro mesmo desafio (dobrando os pontos, já que awardPoints não conferia
  // se o desafio já tinha sido aprovado). O backend (lib/points.js) já foi corrigido
  // pra ser idempotente; isso aqui é uma segunda camada de proteção na UI.
  const [processandoId, setProcessandoId] = useState(null);
  const { perfil } = useAuth();

  useEffect(() => {
    const unsub = subscribeToPendingChallenges(setPendentes);
    getAllUsers().then(setUsuarios);
    return () => unsub();
  }, []);

  async function handleCriar() {
    if (!destinatarioId || !titulo.trim() || enviando) return;
    setEnviando(true);
    try {
      await createChallenge({
        destinatarioId,
        criadoPor: perfil.uid,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        pontos: Number(pontos) || 0,
      });
      setTitulo('');
      setDescricao('');
      setCriando(false);
    } catch (err) {
      console.error('Erro ao criar desafio:', err);
    } finally {
      setEnviando(false);
    }
  }

  async function handleAprovar(desafio) {
    if (processandoId) return;
    setProcessandoId(desafio.id);
    try {
      await aprovarDesafio(desafio.id, desafio.destinatarioId, desafio.pontos);
    } catch (err) {
      console.error('Erro ao aprovar desafio:', err);
    } finally {
      setProcessandoId(null);
    }
  }

  async function handleRejeitar(desafio) {
    if (processandoId) return;
    setProcessandoId(desafio.id);
    try {
      await rejeitarDesafio(desafio.id);
    } catch (err) {
      console.error('Erro ao rejeitar desafio:', err);
    } finally {
      setProcessandoId(null);
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setCriando((v) => !v)}
        className="w-full rounded-xl border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700"
      >
        {criando ? 'Cancelar' : '+ Novo desafio individual'}
      </button>

      {criando && (
        <div className="space-y-3 rounded-xl2 border border-coffee-100 bg-cream-card p-4">
          <select
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          >
            <option value="">Escolha a pessoa...</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do desafio"
            className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-coffee-500">Pontos:</span>
            <input
              type="number"
              min={0}
              value={pontos}
              onChange={(e) => setPontos(e.target.value)}
              className="w-20 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-sm text-coffee-800"
            />
          </div>
          <button
            onClick={handleCriar}
            disabled={!destinatarioId || !titulo.trim() || enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Enviar desafio
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">
          Aguardando aprovação
        </h3>
        {pendentes === null && <div className="h-16 animate-pulse rounded-xl bg-coffee-100/60" />}
        {pendentes?.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhum desafio aguardando aprovação.</p>
        )}
        <div className="space-y-2">
          {pendentes?.map((d) => (
            <div key={d.id} className="rounded-xl border border-coffee-100 bg-cream-card p-3.5">
              <p className="text-sm font-semibold text-coffee-800">{d.titulo}</p>
              {d.descricao && <p className="mt-0.5 text-xs text-coffee-500">{d.descricao}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-coffee-400">+{d.pontos} pontos</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejeitar(d)}
                    disabled={processandoId === d.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-700 disabled:opacity-40"
                  >
                    {processandoId === d.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <X size={13} />
                    )}
                  </button>
                  <button
                    onClick={() => handleAprovar(d)}
                    disabled={processandoId === d.id}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 disabled:opacity-40"
                  >
                    {processandoId === d.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Check size={13} />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
