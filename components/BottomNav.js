'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User } from 'lucide-react';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import BowArrowIcon from '@/components/BowArrowIcon';
import PrayingHandsIcon from '@/components/PrayingHandsIcon';

// Mapeia o nome de ícone (string, em lib/constants.js) pro componente de
// verdade — a lista em si (ordem/href/label) vem de ABAS_PRINCIPAIS, pra
// ficar garantidamente igual à ordem usada pelo swipe (useSwipeNavigation).
// Ícones do lucide-react (biblioteca de verdade) + os dois customizados que
// já existiam no app (arco-e-flecha e mãos orando) — a mesma mão-orando
// agora é usada aqui E na aba "Orações" do Perfil, pra ficar igual nos dois
// lugares.
const ICONES = {
  home: Home,
  'bow-arrow': BowArrowIcon,
  'hand-heart': PrayingHandsIcon,
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
              aria-label={label}
              title={label}
              className="flex flex-1 flex-col items-center justify-center py-3"
            >
              <Icone
                size={26}
                strokeWidth={ativo ? 2.3 : 1.8}
                className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
              />
              {/* Texto removido da barra (pedido anterior) — o label
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
