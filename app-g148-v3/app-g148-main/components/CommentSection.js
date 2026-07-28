'use client';

import { useEffect, useState } from 'react';
import { subscribeToComments, addComment, deleteComment } from '@/lib/firestore-helpers';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { Send, Trash2 } from 'lucide-react';

function LinhaComentario({ comentario, podeExcluir, onExcluir }) {
  // CORREÇÃO DE BUG: nome/foto sempre atuais em vez do dado congelado.
  const autor = useUsuarioAtual(comentario.autorId, {
    nome: comentario.autorNome,
    fotoURL: comentario.autorFoto,
  });

  return (
    <li className="flex gap-2.5">
      <Avatar src={autor.fotoURL} nome={autor.nome} tamanho="sm" />
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-coffee-50 px-3 py-2">
          <p className="text-xs font-semibold text-coffee-700">{autor.nome}</p>
          <p className="break-words text-sm text-coffee-700">
            <TextoComLinks texto={comentario.texto} />
          </p>
        </div>
        <div className="mt-1 flex items-center gap-2 px-1">
          <span className="text-[11px] text-coffee-300">
            {comentario.createdAt ? formatDateTimeBR(comentario.createdAt) : 'agora'}
          </span>
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

export default function CommentSection({ postId }) {
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
        { uid: perfil.uid, nome: perfil.nome, fotoURL: perfil.fotoURL },
        valor
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
              comentario={c}
              podeExcluir={c.autorId === perfil.uid || perfil.isAdmin}
              onExcluir={() => handleExcluir(c.id)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={handleEnviar} className="flex items-center gap-2">
        <Avatar src={perfil.fotoURL} nome={perfil.nome} tamanho="sm" />
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
