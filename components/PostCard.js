'use client';

import { useState, useEffect } from 'react';
import { Heart, MessageCircle, Trash2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import CommentSection from '@/components/CommentSection';
import TextoComLinks from '@/components/TextoComLinks';
import ImageViewerModal from '@/components/ImageViewerModal';
import { toggleLike, deletePost } from '@/lib/firestore-helpers';
import { getUsuarioCache } from '@/lib/usersCache';
import { getCachedImageURL } from '@/lib/imageCache';
import { formatDateTimeBR } from '@/lib/dateUtils';

export default function PostCard({ post, usuarioAtual }) {
  const [autor, setAutor] = useState(null);
  const [midiaURL, setMidiaURL] = useState('');
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [imagemAberta, setImagemAberta] = useState(false);
  const [curtindo, setCurtindo] = useState(false);

  const jaCurtiu = post.curtidas?.includes(usuarioAtual?.uid);
  const ehDono = usuarioAtual?.uid === post.autorId;
  const ehAdmin = usuarioAtual?.isAdmin;

  useEffect(() => {
    getUsuarioCache(post.autorId).then(setAutor);
  }, [post.autorId]);

  useEffect(() => {
    if (post.midiaURL) {
      getCachedImageURL(post.midiaURL).then(setMidiaURL);
    }
  }, [post.midiaURL]);

  async function handleLike() {
    if (!usuarioAtual || curtindo) return;
    setCurtindo(true);
    try {
      await toggleLike(post.id, usuarioAtual.uid, jaCurtiu);
    } finally {
      setCurtindo(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Apagar este post?')) return;
    await deletePost(post.id);
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
      {/* Cabeçalho */}
      <div className="mb-3 flex items-center gap-2.5">
        <Avatar src={autor?.fotoURL} nome={autor?.nome || ''} tamanho={36} />
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-coffee-800">
            {autor?.nome || '...'}
          </p>
          <p className="text-[11px] text-coffee-400">
            {post.createdAt?.toDate
              ? formatDateTimeBR(post.createdAt)
              : ''}
          </p>
        </div>
        {post.categoria && (
          <span className="rounded-full border border-coffee-200 px-2.5 py-0.5 text-[10px] font-medium text-coffee-500">
            {post.categoria}
          </span>
        )}
        {(ehDono || ehAdmin) && (
          <button onClick={handleDelete} className="text-coffee-200 hover:text-red-500">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Texto */}
      {post.texto && (
        <TextoComLinks
          texto={post.texto}
          className="mb-3 text-sm leading-relaxed text-coffee-700"
        />
      )}

      {/* Foto */}
      {post.tipo === 'foto' && midiaURL && (
        <button
          onClick={() => setImagemAberta(true)}
          className="mb-3 block w-full overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={midiaURL}
            alt="Foto do post"
            className="w-full object-cover max-h-80"
          />
        </button>
      )}

      {/* Áudio */}
      {post.tipo === 'audio' && post.midiaURL && (
        <audio controls src={post.midiaURL} className="mb-3 w-full" />
      )}

      {/* Rodapé */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={handleLike}
          disabled={curtindo}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            jaCurtiu ? 'text-red-500' : 'text-coffee-300 hover:text-red-400'
          }`}
        >
          <Heart size={17} fill={jaCurtiu ? 'currentColor' : 'none'} />
          {post.curtidas?.length || 0}
        </button>

        <button
          onClick={() => setMostrarComentarios((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-coffee-300 hover:text-coffee-600"
        >
          <MessageCircle size={17} />
          {post.comentariosCount || 0}
        </button>
      </div>

      {mostrarComentarios && (
        <CommentSection postId={post.id} usuarioAtual={usuarioAtual} />
      )}

      {imagemAberta && (
        <ImageViewerModal
          src={midiaURL}
          alt="Foto do post"
          onFechar={() => setImagemAberta(false)}
        />
      )}
    </div>
  );
}
