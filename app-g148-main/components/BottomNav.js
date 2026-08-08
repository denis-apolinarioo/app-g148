'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User } from 'lucide-react';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import { useTemaAtual } from '@/lib/theme';

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
// em vez de ícone de fonte/lib, por isso trocam de arquivo (ativo/inativo)
// em vez de mudar de cor via CSS. Cada um também tem uma variante "-dark"
// (mesmo desenho, só recolorido pro mesmo tom claro que os ícones de
// verdade usam no modo escuro — ver lib/theme.js useTemaAtual), senão eles
// ficavam escuros em cima de fundo escuro e sumiam de vista.
function IconeArcoFlecha({ size, ativo }) {
  const tema = useTemaAtual();
  const sufixo = tema === 'escuro' ? '-dark' : '';
  return (
    <img
      src={ativo ? `/icons/custom/bow-active${sufixo}.png` : `/icons/custom/bow-inactive${sufixo}.png`}
      width={size}
      height={size}
      alt=""
      className="object-contain"
    />
  );
}

function IconeMaosOrando({ size, ativo }) {
  const tema = useTemaAtual();
  const sufixo = tema === 'escuro' ? '-dark' : '';
  return (
    <img
      src={ativo ? `/icons/custom/hands-active-nav${sufixo}.png` : `/icons/custom/hands-inactive${sufixo}.png`}
      width={size}
      height={size}
      alt=""
      className="object-contain"
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
