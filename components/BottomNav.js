'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, User } from 'lucide-react';
import { ABAS_PRINCIPAIS } from '@/lib/constants';

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
// em vez de mudar de cor via CSS. Pra clarear no modo escuro (mesmo
// desenho, só a variante "-dark" com a cor trocada) SEM depender de nenhum
// JS: os dois PNGs (claro e escuro) ficam sempre os dois no DOM, e o CSS
// puro do Tailwind (dark:) decide qual mostrar — exatamente o mesmo
// mecanismo que já recolore os ícones oficiais, só que aqui trocando a
// imagem inteira em vez da cor do texto. Sem hook, sem re-render, sem
// atraso: muda junto com a classe `dark` do <html>, na mesma hora.
function IconeArcoFlecha({ size, ativo }) {
  const base = ativo ? 'bow-active' : 'bow-inactive';
  return (
    <>
      <img
        src={`/icons/custom/${base}.png`}
        width={size}
        height={size}
        alt=""
        className="object-contain dark:hidden"
      />
      <img
        src={`/icons/custom/${base}-dark.png`}
        width={size}
        height={size}
        alt=""
        className="hidden object-contain dark:block"
      />
    </>
  );
}

function IconeMaosOrando({ size, ativo }) {
  const base = ativo ? 'hands-active-nav' : 'hands-inactive';
  return (
    <>
      <img
        src={`/icons/custom/${base}.png`}
        width={size}
        height={size}
        alt=""
        className="object-contain dark:hidden"
      />
      <img
        src={`/icons/custom/${base}-dark.png`}
        width={size}
        height={size}
        alt=""
        className="hidden object-contain dark:block"
      />
    </>
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
