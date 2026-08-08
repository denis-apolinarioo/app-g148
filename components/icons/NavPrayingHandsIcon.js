// Ícone sólido (preenchido) de mãos em oração, no estilo do pacote de
// ícones de referência do usuário — usado só na barra inferior (BottomNav),
// no lugar do "HandHeart" do lucide-react. O PrayingHandsIcon.js original
// (stroke-based) continua igual, pois é usado na aba "Orações" do Perfil,
// que não foi pedida nesta mudança.
export default function NavPrayingHandsIcon({ size = 22, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M11.5 3c-.2 1.2-.8 2-1.5 2.8-.7.8-1.4 1.6-1.4 2.9v6.6c0 1.9.8 3.4 2.2 4.5.5.4 1.2 0 1.2-.6V8.6c0-.3-.1-.6-.3-.8-.5-.7-.2-1.6.4-2.1.4-.3.6-.8.6-1.3V3Z" />
      <path d="M12.5 3c.2 1.2.8 2 1.5 2.8.7.8 1.4 1.6 1.4 2.9v6.6c0 1.9-.8 3.4-2.2 4.5-.5.4-1.2 0-1.2-.6V8.6c0-.3.1-.6.3-.8.5-.7.2-1.6-.4-2.1-.4-.3-.6-.8-.6-1.3V3Z" />
    </svg>
  );
}
