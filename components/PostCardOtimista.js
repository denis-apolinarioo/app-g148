'use client';

import { Mic as MicIcon, Loader2, AlertCircle } from 'lucide-react';
import Avatar from '@/components/Avatar';

/**
 * PUBLICAÇÃO OTIMISTA — card provisório mostrado no topo do Feed assim que a
 * pessoa toca em "Publicar", antes mesmo do post existir de verdade no
 * Firestore (ver handlePublicar em CreatePostSheet.js e FeedPage). Sem
 * curtida/comentário/menu — é só uma prévia enquanto o envio de verdade
 * roda em segundo plano. Some sozinho assim que o post real chega pelo
 * listener do Feed (comparado por id em FeedPage), trocando de lugar pelo
 * PostCard de sempre, com todas as interações.
 */
export default function PostCardOtimista({ post, usuarioAtual }) {
  return (
    <div className="relative overflow-hidden rounded-xl2 bg-cream-card p-4 shadow-flutuante opacity-70">
      <div className="flex items-center gap-2.5">
        <Avatar src={usuarioAtual?.fotoURL} nome={usuarioAtual?.nome} tamanho={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-coffee-800">{usuarioAtual?.nome}</p>
          <p className="flex items-center gap-1.5 text-xs text-coffee-400">
            {post.erro ? (
              <>
                <AlertCircle size={12} className="text-red-500" />
                Não foi possível publicar
              </>
            ) : (
              <>
                <Loader2 size={12} className="animate-spin" />
                Publicando...
              </>
            )}
          </p>
        </div>
      </div>

      {post.texto && (
        <p className="mt-3 whitespace-pre-wrap break-words text-sm text-coffee-700">{post.texto}</p>
      )}

      {post.tipo === 'foto' && post.midiaURLLocal && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.midiaURLLocal}
          alt=""
          className="mt-3 max-h-72 w-full rounded-xl object-cover"
        />
      )}

      {post.tipo === 'audio' && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream px-3.5 py-2.5 text-sm text-coffee-500">
          <MicIcon size={16} />
          Áudio
        </div>
      )}

      {post.categoria && (
        <span className="mt-3 inline-block rounded-full border border-coffee-200 px-3 py-1 text-[11px] font-medium text-coffee-500">
          {post.categoria}
        </span>
      )}
    </div>
  );
}
