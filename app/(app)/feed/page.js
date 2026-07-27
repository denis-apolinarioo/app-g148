'use client';

import { useState, useEffect } from 'react';
import { Plus, Mailbox } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToFeed } from '@/lib/firestore-helpers';
import VersiculoDiario from '@/components/VersiculoDiario';
import PostCard from '@/components/PostCard';
import CreatePostSheet from '@/components/CreatePostSheet';
import EmptyState from '@/components/EmptyState';
import StreakBadge from '@/components/StreakBadge';
import { MessageSquare } from 'lucide-react';

export default function FeedPage() {
  const { perfil } = useAuth();
  const [posts, setPosts] = useState(null);
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    const unsub = subscribeToFeed(setPosts, 15);
    return () => unsub();
  }, []);

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-coffee-100 bg-cream/95 px-5 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <div>
          <p className="font-display text-lg font-medium text-coffee-800">Geração 148</p>
        </div>
        <div className="flex items-center gap-3">
          <StreakBadge dias={perfil?.streakAtual || 0} />
          <Link href="/correio" className="text-coffee-500">
            <Mailbox size={22} />
          </Link>
        </div>
      </header>

      <div className="space-y-4 px-4 pt-4">
        <VersiculoDiario />

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
          {posts?.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {criando && <CreatePostSheet onFechar={() => setCriando(false)} />}
    </div>
  );
}
