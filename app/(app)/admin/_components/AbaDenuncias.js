'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Flag, Check, ExternalLink, Search } from 'lucide-react';
import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import { subscribeToReports, marcarDenunciaResolvida, getAllUsers } from '@/lib/firestore-helpers';
import { combinaComBusca } from '@/lib/searchUtils';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useAuth } from '@/components/AuthProvider';

// Item 17 — Aba de moderação: só junta as denúncias de post/comentário pra
// decisão manual do Admin. Nenhuma ação automática (a exclusão do conteúdo
// denunciado, se for o caso, continua sendo feita à mão no Feed, como já
// acontece hoje pra qualquer post/comentário).
export default function AbaDenuncias() {
  const { perfil } = useAuth();
  const [denuncias, setDenuncias] = useState(null);
  const [usuarios, setUsuarios] = useState({});
  const [mostrarResolvidas, setMostrarResolvidas] = useState(false);
  const [resolvendoId, setResolvendoId] = useState(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    const unsub = subscribeToReports(setDenuncias);
    return () => unsub();
  }, []);

  // Mapa uid -> usuário, pra mostrar (e buscar) quem é o AUTOR do conteúdo
  // denunciado — antes só aparecia quem denunciou, não quem foi denunciado.
  useEffect(() => {
    getAllUsers()
      .then((lista) => {
        setUsuarios(Object.fromEntries(lista.map((u) => [u.id, u])));
      })
      .catch((err) => console.error('[AbaDenuncias] Erro ao carregar usuários:', err));
  }, []);

  async function handleAlternarResolvida(denuncia) {
    setResolvendoId(denuncia.id);
    try {
      const autor = usuarios[denuncia.conteudoAutorId];
      const contexto = `${denuncia.tipo === 'post' ? 'Post' : 'Comentário'} de ${autor?.nome || 'alguém'}`;
      await marcarDenunciaResolvida(denuncia.id, denuncia.status !== 'resolvida', perfil, contexto);
    } catch (err) {
      console.error('Erro ao atualizar denúncia:', err);
    } finally {
      setResolvendoId(null);
    }
  }

  const lista = useMemo(() => {
    if (!denuncias) return [];
    let filtrada = denuncias.filter((d) => mostrarResolvidas || d.status !== 'resolvida');
    const termo = busca.trim();
    if (termo) {
      filtrada = filtrada.filter((d) => {
        const autor = usuarios[d.conteudoAutorId];
        return (
          combinaComBusca(autor?.nome, termo) ||
          combinaComBusca(autor?.username, termo) ||
          combinaComBusca(d.reportadoPorNome, termo)
        );
      });
    }
    return filtrada;
  }, [denuncias, mostrarResolvidas, busca, usuarios]);

  if (denuncias === null) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou @username (autor ou quem denunciou)..."
          className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
        />
      </div>

      <button
        onClick={() => setMostrarResolvidas((v) => !v)}
        className="text-xs font-medium text-coffee-400 underline"
      >
        {mostrarResolvidas ? 'Ocultar resolvidas' : 'Mostrar resolvidas'}
      </button>

      {lista.length === 0 && (
        <EmptyState
          icone={Flag}
          titulo={busca.trim() ? 'Nenhuma denúncia encontrada' : 'Nenhuma denúncia pendente'}
        />
      )}

      {lista.map((d) => {
        const autor = usuarios[d.conteudoAutorId];
        return (
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

            {autor && (
              <Link href={`/u/${autor.username || d.conteudoAutorId}`} className="mb-1.5 flex items-center gap-2">
                <Avatar src={autor.fotoURL} nome={autor.nome} tamanho="sm" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-coffee-800">{autor.nome}</p>
                  {autor.username && <p className="truncate text-xs text-coffee-400">@{autor.username}</p>}
                </div>
              </Link>
            )}

            {d.conteudoTexto && (
              <p className="mb-1.5 line-clamp-3 text-sm italic text-coffee-600">
                &ldquo;{d.conteudoTexto}&rdquo;
              </p>
            )}

            {d.motivo && <p className="mb-1.5 text-sm text-coffee-700">Motivo: {d.motivo}</p>}

            <p className="mb-2 text-xs text-coffee-300">
              Denunciado por {d.reportadoPorNome || 'alguém'}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              {d.postId && (
                // Item novo (Bloco A) — vai direto no post denunciado (mesmo
                // quando a denúncia é de um comentário, já que o comentário
                // mora dentro do post).
                <Link
                  href={`/post/${d.postId}`}
                  className="flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
                >
                  <ExternalLink size={12} />
                  Ver post
                </Link>
              )}

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
          </div>
        );
      })}
    </div>
  );
}
