'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { combinaComBusca } from '@/lib/searchUtils';

// ============================================================================
// Campo de busca padrão do painel Admin pra "escolher uma pessoa e ver algo
// dela" — mesmo comportamento em toda aba que precisa disso (Histórico,
// Conquistas, Missões, Ações). Digita nome ou @username, aparece uma lista
// com foto + nome + @username, toca pra escolher.
//
// Quando `selecionado` já tem alguém, mostra só o cabeçalho da pessoa
// escolhida com um link "Trocar" — quem usa este componente decide o que
// mostrar abaixo dele (histórico, contagens, etc.); cada aba tem seu
// próprio "modo de operação" a partir daí.
// ============================================================================
export default function BuscaUsuario({
  usuarios,
  selecionado,
  onSelecionar,
  placeholder = 'Buscar por nome ou @username...',
}) {
  const [busca, setBusca] = useState('');

  const encontrados = useMemo(() => {
    if (!usuarios || !busca.trim()) return [];
    return usuarios
      .filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca))
      .slice(0, 20);
  }, [usuarios, busca]);

  if (selecionado) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5">
        <Avatar src={selecionado.fotoURL} nome={selecionado.nome} tamanho="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-coffee-800">{selecionado.nome}</p>
          {selecionado.username && (
            <p className="truncate text-xs text-coffee-400">@{selecionado.username}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSelecionar(null)}
          className="flex-shrink-0 text-xs font-semibold text-coffee-500"
        >
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
        />
      </div>

      {busca.trim() && (
        <div className="mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-coffee-100 bg-cream-card">
          {encontrados.length === 0 && (
            <p className="px-3.5 py-3 text-xs text-coffee-300">
              Ninguém encontrado com esse nome ou @username.
            </p>
          )}
          {encontrados.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => {
                onSelecionar(u);
                setBusca('');
              }}
              className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3.5 py-2.5 text-left last:border-b-0"
            >
              <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
                {u.username && <p className="truncate text-xs text-coffee-400">@{u.username}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
