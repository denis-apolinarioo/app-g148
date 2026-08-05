// Ícone customizado de duas mãos juntas orando, no mesmo estilo visual dos
// ícones lucide-react (stroke-based, 24x24, cantos arredondados) — a
// biblioteca não tem um ícone pronto pra esse tema (só existem variações
// com coração/aperto de mão, não de oração).
export default function PrayingHandsIcon({ size = 20, className = '', strokeWidth = 1.8 }) {
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
      {/* mão esquerda */}
      <path d="M11.3 20c-1.2-1-1.8-2.6-1.8-4.6V8.8c0-.9.5-1.6 1-2.3.6-.8 1-1.7 1-2.8" />
      <path d="M9.5 15.4c-.9-.2-1.6-.9-1.6-2v-3c0-.7.4-1.2.8-1.7" />
      {/* mão direita (espelhada) */}
      <path d="M12.7 20c1.2-1 1.8-2.6 1.8-4.6V8.8c0-.9-.5-1.6-1-2.3-.6-.8-1-1.7-1-2.8" />
      <path d="M14.5 15.4c.9-.2 1.6-.9 1.6-2v-3c0-.7-.4-1.2-.8-1.7" />
      {/* palmas encostadas no centro */}
      <path d="M12 3.7v16" strokeDasharray="0.5 2.2" />
      {/* pulsos/base */}
      <path d="M9.5 20h5" />
    </svg>
  );
}
