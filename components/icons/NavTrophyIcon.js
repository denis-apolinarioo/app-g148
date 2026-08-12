// Ícone sólido (preenchido) de troféu, no estilo do pacote de ícones de
// referência do usuário — usado só na barra inferior (BottomNav), no lugar
// do "Trophy" stroke-based do lucide-react.
export default function NavTrophyIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M4.6 5h2.4c0 2.6.1 4.4.5 5.7C5.8 10.2 4.6 8.1 4.6 5Z" />
      <path d="M19.4 5H17c0 2.6-.1 4.4-.5 5.7 1.7-.5 2.9-2.6 2.9-5.7Z" />
      <path d="M7.2 4h9.6v2.4c0 3.6-2 6.4-4.8 7v2.1h1.9c.6 0 1.1.5 1.1 1.1v.6H8.9v-.6c0-.6.5-1.1 1.1-1.1h1.9v-2.1c-2.8-.6-4.7-3.4-4.7-7V4Z" />
      <rect x="7.3" y="17.6" width="9.4" height="1.5" rx="0.6" />
      <rect x="8.6" y="19.3" width="6.8" height="1.4" rx="0.6" />
    </svg>
  );
}
