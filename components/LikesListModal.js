'use client';

// ============================================================================
// Item 18 — Long-press no curtir → ver quem curtiu.
// Recebe a lista de uids que curtiram (post.curtidas) e busca nome/foto/
// username de cada um via cache em memória (lib/usersCache.js), evitando
// repetir buscas de gente que já apareceu em outro lugar da tela.
// ============================================================================

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { getUsuarioCache } from '@/lib/usersCache';

export default function LikesListModal({ uids, onClose }) {
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    let ativo = true;
    Promise.all(
      (uids || []).map(async (uid) => {
        const dados = await getUsuarioCache(uid);
        return dados ? { uid, ...dados } : null;
      })
    ).then((lista) => {
      if (ativo) setUsuarios(lista.filter(Boolean));
    });
    return () => {
      ativo = false;
    };
  }, [uids]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-base font-semibold text-coffee-800">Curtidas</h2>
          <button onClick={onClose} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <ul className="divide-y divide-coffee-100 px-2 py-2">
          {usuarios === null && (
            <li className="px-3 py-3 text-sm text-coffee-400">Carregando...</li>
          )}
          {usuarios?.length === 0 && (
            <li className="px-3 py-3 text-sm text-coffee-400">Ninguém curtiu ainda.</li>
          )}
          {usuarios?.map((u) => (
            <li key={u.uid}>
              <Link
                href={`/u/${u.username || u.uid}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-coffee-50"
              >
                <Avatar src={u.fotoURL} nome={u.nome} tamanho={36} />
                <span className="text-sm font-medium text-coffee-800">{u.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
