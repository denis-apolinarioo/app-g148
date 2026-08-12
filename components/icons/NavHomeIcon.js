// Ícone sólido (preenchido) de casa, no estilo do pacote de ícones de
// referência do usuário — usado só na barra inferior (BottomNav), no lugar
// do "Home" stroke-based do lucide-react.
export default function NavHomeIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <rect x="14.2" y="3.1" width="2.2" height="4.4" />
      <polygon points="12,2.3 21.2,10.3 19.4,10.3 19.4,10.7 4.6,10.7 4.6,10.3 2.8,10.3" />
      <rect x="5" y="10.3" width="14" height="10.6" rx="1.3" />
    </svg>
  );
}
