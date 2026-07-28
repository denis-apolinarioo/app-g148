'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ListChecks, HandHeart, Trophy, User } from 'lucide-react';

const ITENS = [
  { href: '/feed', label: 'Feed', icone: Home },
  { href: '/missoes', label: 'Missões', icone: ListChecks },
  { href: '/oracao', label: 'Oração', icone: HandHeart },
  { href: '/ranking', label: 'Ranking', icone: Trophy },
  { href: '/perfil', label: 'Perfil', icone: User },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee-100 bg-cream-card/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-1">
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
