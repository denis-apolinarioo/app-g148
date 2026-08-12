import Link from 'next/link';
import Avatar from '@/components/Avatar';

// Medalhas do top 3 (1º, 2º, 3º lugar) em public/icons/ranking/.
const MEDALHAS = [
  '/icons/ranking/medalha-1.png',
  '/icons/ranking/medalha-2.png',
  '/icons/ranking/medalha-3.png',
];

export default function RankingRow({ posicao, usuario, souEu }) {
  const medalha = MEDALHAS[posicao - 1];

  return (
    <Link
      href={`/u/${usuario.username}`}
      className={`flex items-center gap-3 rounded-xl2 border px-3.5 py-3 ${
        souEu ? 'border-coffee-400 bg-coffee-50' : 'border-coffee-100 bg-cream-card'
      }`}
    >
      {/* Medalhas do top 3 um pouco maiores que o número puro das demais
          posições, pra dar mais destaque sem exagerar. */}
      <span className="flex w-9 flex-shrink-0 items-center justify-center">
        {medalha ? (
          <img
            src={medalha}
            width={36}
            height={36}
            alt={`${posicao}º lugar`}
            draggable={false}
            onContextMenu={(e) => e.preventDefault()}
            className="pointer-events-none select-none object-contain [-webkit-touch-callout:none] [-webkit-user-drag:none]"
          />
        ) : (
          <span className="font-destaque text-base font-semibold text-coffee-400">
            {posicao}
          </span>
        )}
      </span>
      <Avatar src={usuario.fotoURL} nome={usuario.nome} tamanho="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-destaque text-sm font-semibold text-coffee-800">
          {usuario.nome} {souEu && <span className="text-coffee-300">(você)</span>}
        </p>
        <p className="text-xs text-coffee-300">@{usuario.username}</p>
      </div>
      {/* Streak de constância só aparece no Perfil, não no Ranking. */}
      <span className="flex-shrink-0 font-destaque text-base font-bold text-coffee-700">
        {usuario.pontos || 0}
      </span>
    </Link>
  );
}
