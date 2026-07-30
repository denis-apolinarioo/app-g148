'use client';

import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { getAllUsers } from '@/lib/firestore-helpers';

export default function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  if (!usuarios) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs text-coffee-400">{usuarios.length} pessoas na comunidade</p>
      {usuarios.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
        >
          <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
            <p className="text-xs text-coffee-300">@{u.username}</p>
          </div>
          <span className="font-destaque text-sm font-bold text-coffee-600">{u.pontos || 0}</span>
          {u.isAdmin && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              admin
            </span>
          )}
        </div>
      ))}
      <p className="pt-3 text-xs text-coffee-300">
        Pra tornar alguém admin, é preciso editar diretamente no Firestore (coleção{' '}
        <code>users</code>, campo <code>isAdmin</code> → <code>true</code>) — uma trava extra de
        segurança pra esse tipo de permissão sensível.
      </p>
    </div>
  );
}
