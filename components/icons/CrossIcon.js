// Cruz latina de verdade (como a de Jesus) pro card de Propósito do perfil —
// substitui o ícone "Cross" do lucide-react, que é uma cruz genérica tipo
// "+" (4 hastes iguais, contorno vazado). Esta é desenhada à mão: preenchida
// (fill sólido, sem stroke — "não vazada") e com a haste de baixo mais
// comprida que as outras 3, nas proporções certas de uma cruz latina.
export default function CrossIcon({ size = 14, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className}>
      {/* haste vertical (topo curto, base longa) */}
      <rect x="9.75" y="1.5" width="4.5" height="21" rx="1" fill="currentColor" />
      {/* haste horizontal, cruzando perto do topo */}
      <rect x="3" y="6.5" width="18" height="4.5" rx="1" fill="currentColor" />
    </svg>
  );
}
