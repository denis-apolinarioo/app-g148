/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FAF6EF',
          soft: '#F3ECE0',
          card: '#FFFDF9',
        },
        coffee: {
          50: '#F4EDE4',
          100: '#E4D3BE',
          200: '#CBAD8A',
          300: '#AC8760',
          400: '#8A6644',
          500: '#6B4A2F',
          600: '#543A25',
          700: '#3F2C1C',
          800: '#2C1F14',
          900: '#1C140D',
        },
        gold: {
          DEFAULT: '#B8863B',
          soft: '#D9B679',
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
      },
      animation: {
        curtidaPop: 'curtidaPop 0.7s ease-out forwards',
        cadeadoAbrindo: 'cadeadoAbrindo 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        conquistaRevelada: 'conquistaRevelada 0.45s ease-out 0.25s both',
        chamaFlutuar: 'chamaFlutuar 1.1s ease-in-out infinite',
        faiscaSobe: 'faiscaSobe 0.7s ease-out forwards',
      },
    },
  },
  plugins: [],
};
