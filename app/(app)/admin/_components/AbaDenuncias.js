'use client';

import { useEffect, useState } from 'react';
import { Flag, Check } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { subscribeToReports, marcarDenunciaResolvida } from '@/lib/firestore-helpers';
import { formatDateTimeBR } from '@/lib/dateUtils';

// Item 17 — Aba de moderação: só junta as denúncias de post/comentário pra
// decisão manual do Admin. Nenhuma ação automática (a exclusão do conteúdo
// denunciado, se for o caso, continua sendo feita à mão no Feed, como já
// acontece hoje pra qualquer post/comentário).
export default function AbaDenuncias() {
  const [denuncias, setDenuncias] = useState(null);
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);
  const [resolvendoId, setResolvendoId] = useState(null);

  useEffect(() => {
    const unsub = subscribeToReports(setDenuncias);
    return () => unsub();
  }, []);

  async function handleAlternarResolvida(denuncia) {
    setResolvendoId(denuncia.id);
    try {
      await marcarDenunciaResolvida(denuncia.id, denuncia.status !== 'resolvida');
    } catch (err) {
      console.error('Erro ao atualizar denúncia:', err);
    } finally {
      setResolvendoId(null);
    }
  }

  if (denuncias === null) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  const lista = denuncias.filter((d) => mostrarResolvidas || d.status !== 'resolvida');

  return (
    <div className="space-y-3">
      <button
        onClick={() => setMostrarResolvidas((v) => !v)}
        className="text-xs font-medium text-coffee-400 underline"
      >
        {mostrarResolvidas ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
      </button>

      {lista.length === 0 && <EmptyState icone={Flag} titulo="Nenhuma denúncia pendente" />}

      {lista.map((d) => (
        <div key={d.id} className="rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-coffee-400">
              {d.tipo === 'post' ? 'Post' : 'Comentário'}
              {d.status === 'resolvida' && ' · resolvida'}
            </span>
            <span className="text-[11px] text-coffee-300">
              {d.createdAt?.toDate ? formatDateTimeBR(d.createdAt) : ''}
            </span>
          </div>

          {d.conteudoTexto && (
            <p className="mb-1.5 line-clamp-3 text-sm italic text-coffee-600">
              &ldquo;{d.conteudoTexto}&rdquo;
            </p>
          )}

          {d.motivo && <p className="mb-1.5 text-sm text-coffee-700">Motivo: {d.motivo}</p>}

          <p className="mb-2 text-xs text-coffee-300">
            Denunciado por {d.reportadoPorNome || 'alguém'}
          </p>

          <button
            onClick={() => handleAlternarResolvida(d)}
            disabled={resolvendoId === d.id}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
              d.status === 'resolvida'
                ? 'border-coffee-200 text-coffee-500'
                : 'border-coffee-700 bg-coffee-700 text-cream'
            }`}
          >
            <Check size={12} />
            {d.status === 'resolvida' ? 'Reabrir' : 'Marcar como resolvida'}
          </button>
        </div>
      ))}
    </div>
  );
}
