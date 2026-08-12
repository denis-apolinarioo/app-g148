// Ícone de UMA moeda (Dracma) — desenho baseado no logo real "Dracma Geração
// 148" do Denis (anel duplo de moeda + "D" vazado com uma barra atravessada
// terminando em ponta dos dois lados). Simplificado pra funcionar pequeno
// (16-24px): sem o texto "DRACMA / GERAÇÃO 148" do logo original, que não
// dá pra ler nesse tamanho. Usa currentColor (não uma cor fixa do logo) pra
// sempre herdar a cor certa de onde é usado — hoje sempre className="text-gold",
// o dourado do tema do app. Mesmo padrão de components/BowArrowIcon.js.
export default function DracmaIcon({ size = 20, className = '', strokeWidth = 1.5 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      {/* anel duplo da moeda, como no logo original */}
      <circle cx="12" cy="12" r="10.2" stroke="currentColor" strokeWidth={strokeWidth} />
      <circle cx="12" cy="12" r="8.7" stroke="currentColor" strokeWidth={strokeWidth * 0.6} />

      {/* barra horizontal atravessando o D, com pontas em flecha pros 2 lados */}
      <path
        d="M5.1,12 L7.5,10.2 L17.7,10.2 L20.1,12 L17.7,13.8 L7.5,13.8 Z"
        fill="currentColor"
      />

      {/* "D" vazado (letra oca), sobreposto à barra */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8.8,6.8 L8.8,17.2 L12.5,17.2 C15.85,17.2 18.1,14.9 18.1,12 C18.1,9.1 15.85,6.8 12.5,6.8 Z
           M10.6,8.65 L10.6,15.35 L12.5,15.35 C14.5,15.35 16.05,13.9 16.05,12 C16.05,10.1 14.5,8.65 12.5,8.65 Z"
        fill="currentColor"
      />
    </svg>
  );
}
