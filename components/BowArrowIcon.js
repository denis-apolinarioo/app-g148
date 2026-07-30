// Ícone customizado de arco e flecha, no mesmo estilo visual dos ícones
// lucide-react (stroke-based, 24x24, cantos arredondados) — a biblioteca
// não tem um ícone pronto pra esse tema.
export default function BowArrowIcon({ size = 20, className = '', strokeWidth = 1.8 }) {
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
      {/* corpo do arco */}
      <path d="M6 3c-2.5 3-2.5 15 0 18" />
      {/* corda do arco */}
      <path d="M6 3l1.5 9L6 21" strokeDasharray="1.5 2" />
      {/* flecha */}
      <path d="M4 12h14" />
      <path d="M21 12l-4-2.2v4.4z" fill="currentColor" stroke="none" />
      <path d="M14 8l4 4" />
    </svg>
  );
}
