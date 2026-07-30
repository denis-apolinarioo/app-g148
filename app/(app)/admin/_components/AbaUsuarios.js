'use client';

import { useEffect, useState } from 'react';
import { Lock, Unlock, Loader2 } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { getAllUsers, toggleTravarUsuario } from '@/lib/firestore-helpers';

export default function AbaUsuarios() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [travandoId, setTravandoId] = useState(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  async function handleAlternarTravamento(usuario) {
    const travar = !usuario.travado;
    const pergunta = travar
      ? `Travar o acesso de ${usuario.nome}? Ela não vai conseguir mais usar o app até você destravar de novo — mesmo que já esteja logada.`
      : `Destravar o acesso de ${usuario.nome}? Ela vai poder usar o app normalmente de novo.`;
    if (!confirm(pergunta)) return;

    setTravandoId(usuario.id);
    try {
      await toggleTravarUsuario(usuario.id, travar, perfil);
      setUsuarios((lista) =>
        lista.map((u) => (u.id === usuario.id ? { ...u, travado: travar } : u))
      );
    } catch (err) {
      console.error('Erro ao travar/destravar usuário:', err);
    } finally {
      setTravandoId(null);
    }
  }

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
          {u.travado && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
              travado
            </span>
          )}
          {/* Item 13 do Bloco 6 — travar/destravar acesso, com confirmação */}
          <button
            onClick={() => handleAlternarTravamento(u)}
            disabled={travandoId === u.id || u.id === perfil?.uid}
            title={
              u.id === perfil?.uid
                ? 'Não é possível travar a própria conta'
                : u.travado
                  ? 'Destravar acesso'
                  : 'Travar acesso'
            }
            className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border disabled:opacity-40 ${
              u.travado
                ? 'border-red-200 bg-red-50 text-red-600'
                : 'border-coffee-100 text-coffee-400'
            }`}
          >
            {travandoId === u.id ? (
              <Loader2 size={14} className="animate-spin" />
            ) : u.travado ? (
              <Unlock size={14} />
            ) : (
              <Lock size={14} />
            )}
          </button>
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
