'use client';

// ============================================================================
// ÍCONE CUSTOMIZADO (desenho em PNG, silhueta sólida com fundo transparente)
// que acompanha a cor do tema — igual aos ícones oficiais do lucide, que já
// usam `currentColor`. PNG não tem `currentColor`, mas dá pra simular: usa a
// própria imagem como MÁSCARA (mask-image — que só olha o canal alfa/
// transparência do PNG, a cor gravada nos pixels não importa mais pra nada)
// e pinta o "buraco" recortado com `background-color: currentColor`,
// herdando a cor de texto normal do Tailwind (ex.: text-coffee-700) — a
// MESMA classe que os ícones lucide ao lado já usam, e que já muda sozinha
// em qualquer preset de Estética (ver lib/theme.js).
//
// BUG CORRIGIDO: antes, cada ícone customizado (arco-e-flecha, mãos orando,
// postar, conquistas) tinha 2 arquivos PNG fixos — cor "gravada" no próprio
// arquivo — trocados só pela classe `dark:` do Tailwind (ligada/desligada
// junto com a classe `dark` do <html>). Isso reproduzia certinho os presets
// Claro/Escuro originais (as imagens foram desenhadas pra bater com eles),
// mas qualquer preset novo (uma cor pastel, por exemplo) deixava esses
// ícones "presos" na cor antiga (marrom ou creme), destoando dos ícones
// oficiais ao lado, que já acompanhavam a cor certa. Com a máscara, os dois
// tipos de ícone (lucide SVG e PNG customizado) agora seguem a MESMA classe
// de cor, então sempre batem — em qualquer preset, sem exceção, sem
// depender mais da classe `dark:` nem de um 2º arquivo por ícone.
// ============================================================================
export default function IconePngColorido({ src, size, className = '' }) {
  return (
    <span
      aria-hidden="true"
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className={`pointer-events-none inline-block flex-shrink-0 select-none bg-current [-webkit-touch-callout:none] [-webkit-user-drag:none] ${className}`}
      style={{
        width: size,
        height: size,
        WebkitMaskImage: `url(${src})`,
        maskImage: `url(${src})`,
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
      }}
    />
  );
}
