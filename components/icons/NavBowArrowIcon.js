// Ícone sólido (preenchido) de arco e flecha, no estilo do pacote de ícones
// de referência do usuário — usado só na barra inferior (BottomNav). O
// BowArrowIcon.js original (stroke-based) continua igual, pois é usado em
// outros lugares (MissionCard, IconGalleryPicker) que não foram pedidos
// nesta mudança.
export default function NavBowArrowIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M7.1 2.9c-3.9 4.3-3.9 13.9 0 18.2l1.3-1.2c-3.3-3.9-3.3-11.9 0-15.8L7.1 2.9Z" />
      <path
        d="M7.5 3.3 8.7 12l-1.2 8.7-.9-.6L7.7 12 6.6 4Z"
        fillOpacity="0.55"
      />
      <g transform="rotate(-28 12 12)">
        <rect x="9.2" y="11.35" width="11.3" height="1.3" />
        <polygon points="21.3,12 17.6,10.1 17.6,13.9" />
        <polygon points="9.5,11.35 6.6,9.9 7.5,12 5.9,12.7 8.5,14 9.7,12.05" />
      </g>
    </svg>
  );
}
