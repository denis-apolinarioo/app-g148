'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User } from 'lucide-react';
import NavBowArrowIcon from '@/components/icons/NavBowArrowIcon';
import NavPrayingHandsIcon from '@/components/icons/NavPrayingHandsIcon';
import { ABAS_PRINCIPAIS } from '@/lib/constants';

// Ícones do lucide-react pra Feed/Ranking/Perfil (mantidos como já estavam,
// só maiores) — envolvidos numa função pra terem a mesma interface
// {size, ativo} dos ícones sólidos abaixo.
function iconeLucide(Cmp) {
  return function IconeLucideWrap({ size, ativo }) {
    return (
      <Cmp
        size={size}
        strokeWidth={ativo ? 2.3 : 1.8}
        className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
      />
    );
  };
}

// CORREÇÃO MODO ESCURO — Missões e Oração usavam PNGs recortados da imagem
// de referência (public/icons/custom/), com a cor "gravada" no arquivo.
// Diferente dos ícones acima (que herdam cor via className e por isso já
// invertiam certinho no escuro, ver html.dark .text-coffee-700/300 em
// app/globals.css), o PNG fica sempre com a MESMA cor não importa o tema —
// no escuro isso deixava esses dois ícones escuros (ilegíveis) enquanto os
// outros três ficavam claros. Troca pros equivalentes em SVG
// (components/icons/NavBowArrowIcon.js e NavPrayingHandsIcon.js, que já
// existiam prontos no projeto mas não tinham sido ligados aqui) — mesmo
// desenho, só que com fill="currentColor", herdando cor da mesma forma que
// os ícones do lucide acima.
function IconeArcoFlecha({ size, ativo }) {
  return <NavBowArrowIcon size={size} className={ativo ? 'text-coffee-700' : 'text-coffee-300'} />;
}

function IconeMaosOrando({ size, ativo }) {
  return <NavPrayingHandsIcon size={size} className={ativo ? 'text-coffee-700' : 'text-coffee-300'} />;
}

// Mapeia o nome de ícone (string, em lib/constants.js) pro componente de
// verdade — a lista em si (ordem/href/label) vem de ABAS_PRINCIPAIS, pra
// ficar garantidamente igual à ordem usada pelo swipe (useSwipeNavigation).
const ICONES = {
  home: iconeLucide(Home),
  'bow-arrow': IconeArcoFlecha,
  'hand-heart': IconeMaosOrando,
  trophy: iconeLucide(Trophy),
  user: iconeLucide(User),
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
              <Icone size={28} ativo={ativo} />
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
