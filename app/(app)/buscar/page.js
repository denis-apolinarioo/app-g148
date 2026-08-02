'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, MessageSquare, X } from 'lucide-react';
import TopBar from '@/components/TopBar';
import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import PostCard from '@/components/PostCard';
import { useAuth } from '@/components/AuthProvider';
import { getAllUsers, subscribeToFeed } from '@/lib/firestore-helpers';
import { combinaComBusca } from '@/lib/searchUtils';

// Quantidade de posts trazidos pra busca — bem maior que os 15 do Feed
// normal, já que aqui a pessoa está procurando algo específico, mas ainda
// limitado (não é uma paginação de verdade, ver item 20º da lista).
const QUANTIDADE_POSTS_BUSCA = 100;

export default function BuscarPage() {
  const { perfil } = useAuth();
  const [aba, setAba] = useState('pessoas'); // 'pessoas' | 'posts'
  const [termo, setTermo] = useState('');

  const [usuarios, setUsuarios] = useState(null);
  const [posts, setPosts] = useState(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  useEffect(() => {
    const unsub = subscribeToFeed(setPosts, QUANTIDADE_POSTS_BUSCA);
    return () => unsub();
  }, []);

  const usuariosFiltrados = useMemo(() => {
    if (!usuarios) return null;
    if (!termo.trim()) return usuarios;
    return usuarios.filter(
      (u) => combinaComBusca(u.nome, termo) || combinaComBusca(u.username, termo)
    );
  }, [usuarios, termo]);

  const postsFiltrados = useMemo(() => {
    if (!posts) return null;
    if (!termo.trim()) return [];
    // Botão "Ocultar" (novo) — post oculto não aparece na busca de ninguém,
    // exceto do próprio dono (placeholder, ver PostCard.js) e do Admin
    // (sempre vê tudo).
    return posts.filter(
      (p) =>
        combinaComBusca(p.texto, termo) &&
        (!p.oculto || p.autorId === perfil?.uid || perfil?.isAdmin)
    );
  }, [posts, termo, perfil]);

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Buscar" voltarPara="/feed" />

      <div className="space-y-4 px-4 pt-4">
        <div className="relative">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-coffee-300"
          />
          <input
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder={aba === 'pessoas' ? 'Buscar por nome ou @username...' : 'Buscar em posts do feed...'}
            className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2.5 pl-9 pr-9 text-sm text-coffee-800"
          />
          {termo && (
            <button
              type="button"
              onClick={() => setTermo('')}
              className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-coffee-400"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAba('pessoas')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${
              aba === 'pessoas' ? 'bg-coffee-700 text-cream' : 'bg-cream-card text-coffee-500'
            }`}
          >
            <Users size={15} /> Pessoas
          </button>
          <button
            type="button"
            onClick={() => setAba('posts')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold ${
              aba === 'posts' ? 'bg-coffee-700 text-cream' : 'bg-cream-card text-coffee-500'
            }`}
          >
            <MessageSquare size={15} /> Posts
          </button>
        </div>

        {aba === 'pessoas' && (
          <div className="space-y-1 pb-6">
            {usuariosFiltrados === null && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl2 bg-coffee-100/60" />
                ))}
              </div>
            )}
            {usuariosFiltrados?.length === 0 && (
              <EmptyState
                icone={Users}
                titulo="Ninguém encontrado"
                descricao="Confira se digitou o nome ou @username corretamente."
              />
            )}
            {usuariosFiltrados?.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.username}`}
                className="flex items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
              >
                <Avatar src={u.fotoURL} nome={u.nome} tamanho="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
                  {u.username && <p className="truncate text-xs text-coffee-400">@{u.username}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}

        {aba === 'posts' && (
          <div className="space-y-4 pb-6">
            {!termo.trim() && (
              <EmptyState
                icone={MessageSquare}
                titulo="Digite algo pra buscar"
                descricao={`A busca considera os ${QUANTIDADE_POSTS_BUSCA} posts mais recentes do feed.`}
              />
            )}
            {termo.trim() && postsFiltrados === null && (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />
                ))}
              </div>
            )}
            {termo.trim() && postsFiltrados?.length === 0 && (
              <EmptyState
                icone={MessageSquare}
                titulo="Nenhum post encontrado"
                descricao="Tente outra palavra, ou o post pode estar fora dos mais recentes."
              />
            )}
            {postsFiltrados?.map((post) => (
              <PostCard key={post.id} post={post} usuarioAtual={perfil} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
