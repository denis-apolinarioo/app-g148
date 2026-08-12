'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User } from 'lucide-react';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import IconePngColorido from '@/components/IconePngColorido';

// Ícones do lucide-react pra Feed/Ranking/Perfil (mantidos como já estavam,
// só maiores) — envolvidos numa função pra terem a mesma interface
// {size, ativo} dos ícones em imagem abaixo.
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

// Missões e Oração usam os PNGs recortados da imagem de referência que o
// usuário mandou (public/icons/custom/) — arco-e-flecha e mãos orando —
// em vez de ícone de fonte/lib, por isso são silhuetas recortadas em vez
// de vetor.
//
// BUG CORRIGIDO (ícone preso na cor antiga em preset novo): recolorido via
// IconePngColorido (máscara CSS + currentColor) em vez de trocar de
// arquivo PNG pela classe `dark:` — mesma classe de cor
// (text-coffee-700/text-coffee-300) que os ícones lucide ao lado (Feed,
// Ranking, Perfil) já usam, então os dois tipos de ícone sempre acompanham
// o preset ativo juntos. Ver comentário grande em IconePngColorido.js.
function IconeArcoFlecha({ size, ativo }) {
  const base = ativo ? 'bow-active' : 'bow-inactive';
  return (
    <IconePngColorido
      src={`/icons/custom/${base}.png`}
      size={size}
      className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
    />
  );
}

function IconeMaosOrando({ size, ativo }) {
  const base = ativo ? 'hands-active-nav' : 'hands-inactive';
  return (
    <IconePngColorido
      src={`/icons/custom/${base}.png`}
      size={size}
      className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
    />
  );
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
              draggable={false}
              onContextMenu={(e) => e.preventDefault()}
              className="flex flex-1 flex-col items-center justify-center py-3 select-none [-webkit-touch-callout:none]"
            >
              <Icone size={28} ativo={ativo} />
              {/* Texto removido da barra (pedido anterior) — o label
                  continua existindo como aria-label, pra não perder
                  acessibilidade. `title` foi tirado de propósito (tooltip
                  no long press no Android/Chrome). Os ícones em PNG têm
                  pointer-events-none (o toque sempre é capturado por este
                  Link, nunca pela <img>, que é quem o Android abriria o
                  menu de "salvar imagem" em cima) + onContextMenu/
                  -webkit-touch-callout como camada extra de segurança. */}
              <span className="sr-only">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
