'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { subscribeToComments, addComment, deleteComment, toggleCommentLike } from '@/lib/firestore-helpers';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { Send, Trash2, Heart } from 'lucide-react';

const JANELA_DUPLO_TOQUE = 300; // ms — mesmo valor usado no PostCard, pra manter o gesto consistente

function LinhaComentario({ postId, comentario, uidAtual, podeExcluir, onExcluir }) {
  const autor = useUsuarioAtual(comentario.autorId, {
    nome: comentario.autorNome,
    fotoURL: comentario.autorFoto,
  });
  const [curtindo, setCurtindo] = useState(false);
  const [coracaoAnimado, setCoracaoAnimado] = useState(false);
  const ultimoTapRef = useRef(0);

  // Item 20 — Curtir comentários
  const jaCurtiu = comentario.curtidas?.includes(uidAtual);

  async function handleCurtir() {
    if (!uidAtual || curtindo) return;
    setCurtindo(true);
    // Anima só quando está curtindo (não quando está descurtindo)
    if (!jaCurtiu) {
      setCoracaoAnimado(true);
      setTimeout(() => setCoracaoAnimado(false), 700);
    }
    try {
      await toggleCommentLike(postId, comentario.id, uidAtual, jaCurtiu);
    } finally {
      setCurtindo(false);
    }
  }

  // MELHORIA: duplo toque no balão do comentário também curte (nunca
  // descurte), igual ao gesto já usado no texto/foto do post.
  function handleTapNoBalao() {
    const agora = Date.now();
    if (agora - ultimoTapRef.current < JANELA_DUPLO_TOQUE) {
      if (!jaCurtiu) handleCurtir();
      else {
        setCoracaoAnimado(true);
        setTimeout(() => setCoracaoAnimado(false), 700);
      }
    }
    ultimoTapRef.current = agora;
  }

  return (
    <li className="flex items-start gap-2.5">
      {/* CORREÇÃO: items-start no <li> evita que o wrapper do avatar estique
          por conta do "stretch" padrão do flex; o mt-1.5 centraliza o avatar
          com a linha do nome dentro do balão (px-3 py-2). */}
      <div className="flex-shrink-0 mt-1.5">
        <Link href={`/u/${autor.username || comentario.autorId}`}>
          <Avatar src={autor.fotoURL} nome={autor.nome} tamanho={28} />
        </Link>
      </div>
      <div className="min-w-0 flex-1">
        <div onClick={handleTapNoBalao} className="relative rounded-2xl bg-coffee-50 px-3 py-2">
          <Link
            href={`/u/${autor.username || comentario.autorId}`}
            className="text-xs font-semibold text-coffee-700 hover:underline"
          >
            {autor.nome}
          </Link>
          <p className="break-words text-sm text-coffee-700">
            <TextoComLinks texto={comentario.texto} />
          </p>
          {coracaoAnimado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={32} className="animate-curtidaPop text-red-500 drop-shadow" fill="currentColor" />
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-3 px-1">
          <span className="text-[11px] text-coffee-300">
            {comentario.createdAt ? formatDateTimeBR(comentario.createdAt) : 'agora'}
          </span>
          <button
            onClick={handleCurtir}
            disabled={curtindo}
            className={`flex items-center gap-1 text-[11px] font-medium ${
              jaCurtiu ? 'text-red-500' : 'text-coffee-300 hover:text-red-400'
            }`}
          >
            <Heart size={11} fill={jaCurtiu ? 'currentColor' : 'none'} />
            {comentario.curtidas?.length > 0 && comentario.curtidas.length}
          </button>
          {podeExcluir && (
            <button
              onClick={onExcluir}
              className="text-coffee-300 hover:text-red-700"
              aria-label="Excluir comentário"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

export default function CommentSection({ postId, postAutorId }) {
  const { perfil } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const unsub = subscribeToComments(postId, setComentarios);
    return () => unsub();
  }, [postId]);

  async function handleEnviar(e) {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor || enviando) return;
    setEnviando(true);
    setTexto('');
    try {
      await addComment(
        postId,
        { uid: perfil.uid, nome: perfil.nome, fotoURL: perfil.fotoURL, username: perfil.username },
        valor,
        postAutorId
      );
    } catch (err) {
      console.error('Erro ao comentar:', err);
      setTexto(valor);
    } finally {
      setEnviando(false);
    }
  }

  async function handleExcluir(commentId) {
    try {
      await deleteComment(postId, commentId);
    } catch (err) {
      console.error('Erro ao excluir comentário:', err);
    }
  }

  return (
    <div className="border-t border-coffee-100 px-4 py-3">
      {comentarios.length > 0 && (
        <ul className="mb-3 space-y-3">
          {comentarios.map((c) => (
            <LinhaComentario
              key={c.id}
              postId={postId}
              comentario={c}
              uidAtual={perfil?.uid}
              podeExcluir={c.autorId === perfil?.uid || perfil?.isAdmin}
              onExcluir={() => handleExcluir(c.id)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleEnviar} className="flex items-center gap-2">
        <Avatar src={perfil?.fotoURL} nome={perfil?.nome || ''} tamanho={28} />
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escreva um comentário..."
          className="flex-1 rounded-full border border-coffee-100 bg-cream px-3.5 py-2 text-sm text-coffee-800 placeholder:text-coffee-300"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-coffee-700 text-cream disabled:opacity-30"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
