import { Flame } from 'lucide-react';

export default function StreakBadge({ dias = 0, tamanho = 'md' }) {
  if (!dias) return null;

  const grande = tamanho === 'lg';

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-gold/15 ${
        grande ? 'px-4 py-2' : 'px-2.5 py-1'
      }`}
    >
      <Flame size={grande ? 18 : 13} className="text-gold" fill="currentColor" />
      <span className={`font-destaque font-semibold text-coffee-700 ${grande ? 'text-base' : 'text-xs'}`}>
        {dias} {dias === 1 ? 'dia' : 'dias'}
      </span>
    </div>
  );
}
