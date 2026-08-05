'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, HandHeart, Trophy, User } from 'lucide-react';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import BowArrowIcon from '@/components/BowArrowIcon';

// Mapeia o nome de ícone (string, em lib/constants.js) pro componente lucide
// de verdade — a lista em si (ordem/href/label) vem de ABAS_PRINCIPAIS, pra
// ficar garantidamente igual à ordem usada pelo swipe (useSwipeNavigation).
const ICONES = {
  home: Home,
  // Ícone de arco e flecha no lugar do genérico de lista de tarefas.
  'bow-arrow': BowArrowIcon,
  'hand-heart': HandHeart,
  trophy: Trophy,
  user: User,
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
              className="flex flex-1 flex-col items-center gap-1 py-2.5"
            >
              <Icone
                size={22}
                strokeWidth={ativo ? 2.4 : 1.8}
                className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
              />
              <span
                className={`text-[10px] font-medium ${
                  ativo ? 'text-coffee-700' : 'text-coffee-300'
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
