'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import NavHomeIcon from '@/components/icons/NavHomeIcon';
import NavBowArrowIcon from '@/components/icons/NavBowArrowIcon';
import NavPrayingHandsIcon from '@/components/icons/NavPrayingHandsIcon';
import NavTrophyIcon from '@/components/icons/NavTrophyIcon';
import NavPersonIcon from '@/components/icons/NavPersonIcon';

// Mapeia o nome de ícone (string, em lib/constants.js) pro componente de
// verdade — a lista em si (ordem/href/label) vem de ABAS_PRINCIPAIS, pra
// ficar garantidamente igual à ordem usada pelo swipe (useSwipeNavigation).
// Ícones sólidos (preenchidos), no estilo do pacote de referência do
// usuário — cada um só é usado aqui na barra inferior.
const ICONES = {
  home: NavHomeIcon,
  'bow-arrow': NavBowArrowIcon,
  'hand-heart': NavPrayingHandsIcon,
  trophy: NavTrophyIcon,
  user: NavPersonIcon,
};

const ITENS = ABAS_PRINCIPAIS.map((aba) => ({ ...aba, icone: ICONES[aba.icone] }));

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-100 bg-cream-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl items-stretch justify-between px-1">
        {ITENS.map(({ href, label, icone: Icone }) => {
          const ativo = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              title={label}
              className="flex flex-1 flex-col items-center justify-center py-3"
            >
              <Icone
                size={23}
                className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
              />
              {/* Texto removido da barra (pedido do usuário) — o label
                  continua existindo como aria-label/title, pra não perder
                  acessibilidade. */}
              <span className="sr-only">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
