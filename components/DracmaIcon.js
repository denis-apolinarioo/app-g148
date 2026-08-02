// Ícone de UMA moeda (Dracma), no mesmo estilo visual dos ícones lucide-react
// (stroke-based, 24x24, cantos arredondados) — substitui o ícone "Coins" da
// lucide (que mostra uma pilha de 2 moedas) nos lugares que representam a
// moeda Dracma, a pedido do Denis ("quero mudar o ícone das dracmas pra 1
// moeda"). Mesmo padrão de components/BowArrowIcon.js.
export default function DracmaIcon({ size = 20, className = '', strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* borda externa da moeda */}
      <circle cx="12" cy="12" r="9" />
      {/* friso interno (relevo da moeda) */}
      <circle cx="12" cy="12" r="5.75" />
      {/* marca central, lembrando um "D" de Dracma */}
      <path d="M10.5 9v6c1.8 0 3-1.2 3-3s-1.2-3-3-3z" fill="currentColor" stroke="none" />
    </svg>
  );
}
