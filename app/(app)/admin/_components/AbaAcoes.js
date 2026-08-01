'use client';

import { useEffect, useState, useCallback } from 'react';
import { Check, Loader2, Save } from 'lucide-react';
import { getPontosEfetivos, salvarPontosDaMissao } from '@/lib/missionOverrides';
import { useAuth } from '@/components/AuthProvider';

export default function AbaAcoes() {
  const { perfil } = useAuth();
  const [mapaPontos, setMapaPontos] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [salvoId, setSalvoId] = useState(null);

  const carregar = useCallback(() => {
    getPontosEfetivos().then(setMapaPontos);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSalvar(missaoId, valor) {
    const numero = Number(valor);
    if (Number.isNaN(numero) || numero < 0) return;
    setSalvandoId(missaoId);
    try {
      await salvarPontosDaMissao(missaoId, numero, perfil);
      setMapaPontos((m) => ({ ...m, [missaoId]: numero }));
      setSalvoId(missaoId);
      setTimeout(() => setSalvoId(null), 1500);
    } catch (err) {
      console.error('Erro ao salvar pontos:', err);
    } finally {
      setSalvandoId(null);
    }
  }

  if (!mapaPontos) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <p className="text-xs text-coffee-400">
        Os pontos de cada missão agora se editam direto na aba{' '}
        <span className="font-semibold text-coffee-600">Missões</span> (junto com o resto da
        missão). Aqui fica só o que não é missão.
      </p>
      <GrupoPontos
        titulo="Outras ações"
        missoes={[
          { id: 'postarNoFeed', titulo: 'Post no Feed' },
          { id: 'orarPorAlguem', titulo: 'Orar por alguém' },
        ]}
        mapa={mapaPontos}
        onSalvar={handleSalvar}
        salvandoId={salvandoId}
        salvoId={salvoId}
      />
    </div>
  );
}

function GrupoPontos({ titulo, missoes, mapa, onSalvar, salvandoId, salvoId }) {
  const [valores, setValores] = useState({});

  return (
    <div>
      <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">{titulo}</h3>
      <div className="space-y-2">
        {missoes.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5"
          >
            <span className="flex-1 truncate text-sm text-coffee-700">{m.titulo}</span>
            <input
              type="number"
              min={0}
              defaultValue={mapa[m.id]}
              onChange={(e) => setValores((v) => ({ ...v, [m.id]: e.target.value }))}
              className="w-16 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-center text-sm text-coffee-800"
            />
            <button
              onClick={() => onSalvar(m.id, valores[m.id] ?? mapa[m.id])}
              disabled={salvandoId === m.id}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-coffee-700 text-cream disabled:opacity-40"
            >
              {salvandoId === m.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : salvoId === m.id ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
