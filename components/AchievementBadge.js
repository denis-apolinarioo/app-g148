import * as Icons from 'lucide-react';

function iconePascalCase(nomeKebab) {
  return nomeKebab
    .split('-')
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join('');
}

export default function AchievementBadge({ conquista }) {
  const Icone = Icons[iconePascalCase(conquista.icone)] || Icons.Award;

  return (
    <div className="flex flex-col items-center gap-1.5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15">
        <Icone size={24} className="text-gold" strokeWidth={1.8} />
      </div>
      <p className="font-destaque text-[11px] font-semibold leading-tight text-coffee-600">{conquista.nome}</p>
    </div>
  );
}
