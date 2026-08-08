// Ícone sólido (preenchido) de medalha, no estilo do pacote de ícones de
// referência do usuário — usado na aba "Conquistas" do Perfil, no lugar do
// "Award" do lucide-react.
export default function NavMedalIcon({ size = 20, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M8.4 2.6 12 8.2l3.6-5.6h2.3l-4.6 7.1.9 1.5H18l-4.5 6.9-1.5-2.2-1.5 2.2L6 11.2h3.6l.9-1.5L6 2.6h2.4Z" />
      <circle cx="12" cy="15.1" r="4.6" />
      <circle cx="12" cy="15.1" r="2.5" fillOpacity="0.35" />
    </svg>
  );
}
