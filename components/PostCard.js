'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import CommentSection from '@/components/CommentSection';
import { useAuth } from '@/components/AuthProvider';
import { toggleLike, deletePost } from '@/lib/firestore-helpers';
import { formatDateTimeBR } from '@/lib/dateUtils';

export default function PostCard({ post }) {
  const { perfil } = useAuth();
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [curtindo, setCurtindo] = useState(false);

  const jaCurtiu = (post.curtidas || []).includes(perfil?.uid);
  const totalCurtidas = (post.curtidas || []).length;
  const podeExcluir = post.autorId === perfil?.uid || perfil?.isAdmin;

  async function handleLike() {
    if (curtindo) return;
    setCurtindo(true);
    try {
      await toggleLike(post.id, perfil.uid, jaCurtiu);
    } catch (err) {
      console.error('Erro ao curtir:', err);
    } finally {
      setCurtindo(false);
    }
  }

  async function handleCompartilhar() {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'G148', text: post.texto?.slice(0, 100), url });
      } catch {
        // pessoa cancelou o compartilhamento — não é erro
      }
    } else {
      await navigator.clipboard.writeText(url);
      alert('Link copiado!');
    }
  }

  async function handleExcluir() {
    if (!confirm('Excluir esse post? Essa ação não pode ser desfeita.')) return;
    try {
      await deletePost(post.id);
    } catch (err) {
      console.error('Erro ao excluir post:', err);
    }
  }

  return (
    <article className="rounded-xl2 border border-coffee-100 bg-cream-card shadow-card">
      <div className="flex items-start gap-3 px-4 pt-4">
        <Link href={`/u/${post.autorUsername}`}>
          <Avatar src={post.autorFoto} nome={post.autorNome} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${post.autorUsername}`} className="font-semibold text-coffee-800">
            {post.autorNome}
          </Link>
          <p className="text-xs text-coffee-300">
            {post.createdAt ? formatDateTimeBR(post.createdAt) : 'agora'}
          </p>
        </div>
        {post.categoria && (
          <span className="flex-shrink-0 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-semibold text-gold">
            {post.categoria}
          </span>
        )}
        {podeExcluir && (
          <button
            onClick={handleExcluir}
            className="flex-shrink-0 text-coffee-200 hover:text-red-700"
            aria-label="Excluir post"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {post.texto && (
        <p className="whitespace-pre-wrap px-4 pt-3 text-[15px] leading-relaxed text-coffee-700">
          {post.texto}
        </p>
      )}

      {post.tipo === 'foto' && post.midiaURL && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.midiaURL}
          alt="Foto do post"
          className="mt-3 max-h-[480px] w-full object-cover"
        />
      )}

      {post.tipo === 'audio' && post.midiaURL && (
        <div className="px-4 pt-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={post.midiaURL} className="w-full" />
        </div>
      )}

      <div className="mt-1 flex items-center gap-1 px-2 py-1.5">
        <button
          onClick={handleLike}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-coffee-500"
        >
          <Heart
            size={18}
            className={jaCurtiu ? 'text-red-600' : 'text-coffee-300'}
            fill={jaCurtiu ? 'currentColor' : 'none'}
          />
          {totalCurtidas > 0 && totalCurtidas}
        </button>
        <button
          onClick={() => setMostrarComentarios((v) => !v)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-coffee-500"
        >
          <MessageCircle size={18} className="text-coffee-300" />
          {post.comentariosCount > 0 && post.comentariosCount}
        </button>
        <button
          onClick={handleCompartilhar}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-coffee-500"
        >
          <Share2 size={17} className="text-coffee-300" />
        </button>
      </div>

      {mostrarComentarios && <CommentSection postId={post.id} />}
    </article>
  );
}
