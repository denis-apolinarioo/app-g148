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
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      boxShadow: {
        soft: '0 2px 16px rgba(44, 31, 20, 0.06)',
        card: '0 1px 3px rgba(44, 31, 20, 0.08), 0 1px 2px rgba(44, 31, 20, 0.05)',
      },
    },
  },
  plugins: [],
};
