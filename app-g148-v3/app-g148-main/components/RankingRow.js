import Link from 'next/link';
import Avatar from '@/components/Avatar';
import StreakBadge from '@/components/StreakBadge';

const MEDALHAS = ['🥇', '🥈', '🥉'];

export default function RankingRow({ posicao, usuario, souEu }) {
  const medalha = MEDALHAS[posicao - 1];

  return (
    <Link
      href={`/u/${usuario.username}`}
      className={`flex items-center gap-3 rounded-xl2 border px-3.5 py-3 ${
        souEu ? 'border-coffee-400 bg-coffee-50' : 'border-coffee-100 bg-cream-card'
      }`}
    >
      <span className="flex w-7 flex-shrink-0 items-center justify-center font-destaque text-base font-semibold text-coffee-400">
        {medalha || posicao}
      </span>
      <Avatar src={usuario.fotoURL} nome={usuario.nome} tamanho="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-destaque text-sm font-semibold text-coffee-800">
          {usuario.nome} {souEu && <span className="text-coffee-300">(você)</span>}
        </p>
        <p className="text-xs text-coffee-300">@{usuario.username}</p>
      </div>
      {usuario.streakAtual > 0 && <StreakBadge dias={usuario.streakAtual} />}
      <span className="flex-shrink-0 font-destaque text-base font-bold text-coffee-700">
        {usuario.pontos || 0}
      </span>
    </Link>
  );
}
