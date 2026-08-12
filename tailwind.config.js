// ============================================================================
// PALETA VIA VARIÁVEL CSS (aba Estética do Admin) — cada cor da paleta
// (cream/coffee/gold/forte) deixou de ser um valor fixo aqui e passou a ler
// uma variável CSS custom property (--cor-*), definida em app/globals.css
// (:root, valores padrão do preset "Claro") e trocada em runtime pelo
// preset ativo (ver lib/theme.js -> aplicarPreset), sem precisar de rebuild
// nem redeploy pra uma cor nova aparecer.
//
// `withOpacity` é o padrão oficial do Tailwind pra variável CSS + suporte a
// opacidade (bg-cream/95, bg-coffee-100/60 etc., já usados no app) — a
// variável guarda "R G B" (números separados por espaço, não hex), daí o
// `rgb(var(--x) / opacidade)`.
//
// `coffee` (50-900) é a escala ADAPTÁVEL: muda de verdade conforme o preset
// (clara vira escura e vice-versa) — é a família usada pra TEXTO, borda e
// fundo de superfície/cartão em geral.
//
// `forte` (DEFAULT/800/900) é NOVA — extraída do que antes eram os usos de
// bg-coffee-700/800/900 e border-coffee-700 (botões sólidos, overlay/scrim
// de modal, selo). Motivo de existir separada da escala `coffee`: um botão
// com fundo escuro e texto claro (text-texto-forte, também sempre claro —
// ver comentário dela abaixo) precisa continuar ESCURO em QUALQUER preset
// (claro, escuro ou uma cor nova) — se ele puxasse a mesma variável
// adaptável do texto, um preset escuro deixaria o fundo do botão CLARO e
// o texto ficaria ilegível em cima.
// `forte` sempre gera um tom escuro/saturado a partir da Cor Principal do
// preset (ver lib/paletaGerador.js), então botões continuam legíveis com
// texto claro em cima não importa qual preset esteja ativo.
function withOpacity(varName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `rgb(var(${varName}) / ${opacityValue})`;
    }
    return `rgb(var(${varName}))`;
  };
}

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: withOpacity('--cor-cream'),
          soft: withOpacity('--cor-cream-soft'),
          card: withOpacity('--cor-cream-card'),
        },
        coffee: {
          50: withOpacity('--cor-coffee-50'),
          100: withOpacity('--cor-coffee-100'),
          200: withOpacity('--cor-coffee-200'),
          300: withOpacity('--cor-coffee-300'),
          400: withOpacity('--cor-coffee-400'),
          500: withOpacity('--cor-coffee-500'),
          600: withOpacity('--cor-coffee-600'),
          700: withOpacity('--cor-coffee-700'),
          800: withOpacity('--cor-coffee-800'),
          900: withOpacity('--cor-coffee-900'),
        },
        forte: {
          DEFAULT: withOpacity('--cor-forte'),
          800: withOpacity('--cor-forte-800'),
          900: withOpacity('--cor-forte-900'),
        },
        // BUG CORRIGIDO — texto/ícone em cima de superfície "forte" (botão
        // sólido, cartão do Verso do Dia etc.): antes usava `cream`, que é
        // o FUNDO DA PÁGINA — funcionava por coincidência no claro, sumia
        // no escuro. Sempre clara, companheira do `forte` (sempre escuro)
        // — ver gerarTextoForte em lib/paletaGerador.js.
        'texto-forte': {
          DEFAULT: withOpacity('--cor-texto-forte'),
        },
        gold: {
          DEFAULT: withOpacity('--cor-gold'),
          soft: withOpacity('--cor-gold-soft'),
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        destaque: ['var(--font-destaque)', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 16px rgba(44, 31, 20, 0.06)',
        card: '0 1px 3px rgba(44, 31, 20, 0.08), 0 1px 2px rgba(44, 31, 20, 0.05)',
      },
      keyframes: {
        curtidaPop: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '30%': { transform: 'scale(1.15)', opacity: '1' },
          '55%': { transform: 'scale(0.95)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
        cadeadoAbrindo: {
          '0%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
          '35%': { transform: 'scale(1.25) rotate(-18deg)', opacity: '1' },
          '65%': { transform: 'scale(1.1) rotate(10deg)', opacity: '1' },
          '100%': { transform: 'scale(0.4) rotate(0deg)', opacity: '0' },
        },
        conquistaRevelada: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        chamaFlutuar: {
          '0%, 100%': { transform: 'scaleY(1) rotate(-4deg)' },
          '50%': { transform: 'scaleY(1.12) rotate(4deg)' },
        },
        faiscaSobe: {
          '0%': { transform: 'translateY(0) scale(0.85)', opacity: '1' },
          '100%': { transform: 'translateY(-38px) scale(0.4)', opacity: '0' },
        },
        // Faísca da fogueira do streak (StreakFogueira.js — automáticas a
        // cada ~0,5s e também no toque). Curva em 3 trechos, não linha reta:
        // estoura em qualquer direção (--faisca-tx1/ty1) e depois sempre
        // curva pra cima (--faisca-tx2/ty2 e --faisca-tx3/ty3), não importa
        // de que lado ela saiu.
        faiscaVoa: {
          '0%': { transform: 'translate(0, 0) scale(0.85)', opacity: '1' },
          '22%': {
            transform: 'translate(var(--faisca-tx1, 0px), var(--faisca-ty1, -4px)) scale(1)',
            opacity: '1',
          },
          '60%': {
            transform: 'translate(var(--faisca-tx2, 0px), var(--faisca-ty2, -20px)) scale(0.65)',
            opacity: '0.85',
          },
          '100%': {
            transform: 'translate(var(--faisca-tx3, 0px), var(--faisca-ty3, -46px)) scale(0.25)',
            opacity: '0',
          },
        },
        // Flutuação bem sutil dos medalhões da vitrine, pra dar sensação de
        // "peça de mostruário" viva, sem exagerar.
        vitrineFlutuar: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        // Entrada do popup flutuante de detalhe da conquista (abre/fecha ao
        // tocar num selo, ver ConquistaDetalheModal).
        popupFlutuante: {
          '0%': { transform: 'scale(0.86) translateY(10px)', opacity: '0' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
      },
      animation: {
        curtidaPop: 'curtidaPop 0.7s ease-out forwards',
        cadeadoAbrindo: 'cadeadoAbrindo 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        conquistaRevelada: 'conquistaRevelada 0.45s ease-out 0.25s both',
        chamaFlutuar: 'chamaFlutuar 1.1s ease-in-out infinite',
        faiscaSobe: 'faiscaSobe 0.7s ease-out forwards',
        faiscaVoa: 'faiscaVoa 0.9s ease-out forwards',
        vitrineFlutuar: 'vitrineFlutuar 3.2s ease-in-out infinite',
        popupFlutuante: 'popupFlutuante 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
