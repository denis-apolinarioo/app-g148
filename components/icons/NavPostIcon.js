// Ícone de "card de post" (janela com cabeçalho + linhas de conteúdo), no
// estilo da imagem isolada de referência do usuário — usado na aba "Posts"
// do Perfil, no lugar do "LayoutGrid" do lucide-react.
export default function NavPostIcon({ size = 20, className = '', strokeWidth = 1.8 }) {
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
      <rect x="3.5" y="3.5" width="17" height="17" rx="2.3" />
      <circle cx="6.4" cy="6.4" r="0.55" fill="currentColor" stroke="none" />
      <line x1="8.1" y1="6.4" x2="12.6" y2="6.4" />
      <line x1="3.5" y1="8.7" x2="20.5" y2="8.7" />
      <rect x="6" y="10.6" width="3.1" height="3.1" rx="0.6" />
      <line x1="10.8" y1="11.3" x2="17" y2="11.3" />
      <line x1="10.8" y1="12.9" x2="15.4" y2="12.9" />
      <rect x="6" y="15.3" width="3.1" height="3.1" rx="0.6" />
      <line x1="10.8" y1="16" x2="16.4" y2="16" />
      <line x1="10.8" y1="17.6" x2="14" y2="17.6" />
    </svg>
  );
}
