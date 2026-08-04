'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import MailboxLink from '@/components/MailboxLink';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToFeed } from '@/lib/firestore-helpers';
import { getFeedPreCarregado } from '@/lib/preload';
import VersiculoDiario from '@/components/VersiculoDiario';
import PostCard from '@/components/PostCard';
import CreatePostSheet from '@/components/CreatePostSheet';
import EmptyState from '@/components/EmptyState';
import StreakBadge from '@/components/StreakBadge';
import { MessageSquare } from 'lucide-react';
import { useAppConfig } from '@/lib/useAppConfig';
import { CHAVE_BLOQUEIO_USUARIO_ATIVO } from '@/lib/appConfig';

const QUANTIDADE_BASE = 15;
const QUANTIDADE_INCREMENTO = 15;

export default function FeedPage() {
  const { perfil } = useAuth();
  // Item 12 do Bloco 5 — com a função desligada pelo Admin, ninguém mais
  // some do feed de ninguém, mesmo quem já tinha sido bloqueado antes.
  const config = useAppConfig();
  const bloqueioAtivo = config?.[CHAVE_BLOQUEIO_USUARIO_ATIVO] !== false;
  const [posts, setPosts] = useState(() => getFeedPreCarregado());
  const [criando, setCriando] = useState(false);
  const [limite, setLimite] = useState(QUANTIDADE_BASE);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    const unsub = subscribeToFeed((novosPosts) => {
      setPosts(novosPosts);
      setCarregandoMais(false);
    }, limite);
    return () => unsub();
  }, [limite]);

  // Se voltou menos posts do que o pedido, é porque já chegou no fim do
  // mural — não tem mais nada pra carregar.
  const semMaisPosts = posts !== null && posts.length < limite;

  function carregarMais() {
    setCarregandoMais(true);
    setLimite((l) => l + QUANTIDADE_INCREMENTO);
  }

  // Item 18 — oculta, só pra quem bloqueou, os posts de quem foi bloqueado
  // (o bloqueio é local ao perfil de quem bloqueia, filtrado aqui no cliente)
  // Botão "Ocultar" (novo) — post oculto some do Feed de todo mundo, exceto
  // do próprio dono (que vê um placeholder, ver PostCard.js) e do Admin
  // (que sempre vê tudo, normalmente).
  const postsVisiveis = (
    bloqueioAtivo && perfil?.bloqueados?.length
      ? posts?.filter((p) => !perfil.bloqueados.includes(p.autorId))
      : posts
  )?.filter((p) => !p.oculto || p.autorId === perfil?.uid || perfil?.isAdmin);

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-coffee-100 bg-cream/95 px-5 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <div>
          <p className="font-destaque text-lg font-semibold text-coffee-800">Geração 148</p>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge dias={perfil?.streakAtual || 0} />
          <Link href="/buscar" className="text-coffee-600">
            <Search size={22} />
          </Link>
          <MailboxLink size={22} />
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <VersiculoDiario uid={perfil?.uid} />

        <button
          onClick={() => setCriando(true)}
          className="flex w-full items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-4 py-3.5 text-left shadow-card"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-coffee-100">
            <Plus size={18} className="text-coffee-600" />
          </span>
          <span className="text-sm text-coffee-400">Compartilhe algo com a comunidade...</span>
        </button>

        {posts === null && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        )}

        {posts?.length === 0 && (
          <EmptyState
            icone={MessageSquare}
            titulo="Ainda não tem nada por aqui"
            descricao="Seja a primeira pessoa a compartilhar algo com a comunidade."
          />
        )}

        <div className="space-y-4 pb-6">
          {postsVisiveis?.map((post) => (
            <PostCard key={post.id} post={post} usuarioAtual={perfil} />
          ))}

          {posts?.length > 0 && !semMaisPosts && (
            <button
              onClick={carregarMais}
              disabled={carregandoMais}
              className="flex w-full items-center justify-center gap-2 rounded-xl2 border border-coffee-100 bg-cream-card py-3 text-sm font-semibold text-coffee-600 disabled:opacity-60"
            >
              {carregandoMais && <Loader2 size={15} className="animate-spin" />}
              Carregar mais
            </button>
          )}
        </div>
      </div>

      {criando && <CreatePostSheet onFechar={() => setCriando(false)} />}
    </div>
  );
}
