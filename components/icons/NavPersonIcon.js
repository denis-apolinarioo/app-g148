// Ícone sólido (preenchido) de pessoa, no estilo do pacote de ícones de
// referência do usuário — usado só na barra inferior (BottomNav), no lugar
// do "User" stroke-based do lucide-react.
export default function NavPersonIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <circle cx="12" cy="7.3" r="3.6" />
      <path d="M4.3 20.3c0-4.3 3.5-6.9 7.7-6.9s7.7 2.6 7.7 6.9c0 .6-.5 1.1-1.1 1.1H5.4c-.6 0-1.1-.5-1.1-1.1Z" />
    </svg>
  );
}
