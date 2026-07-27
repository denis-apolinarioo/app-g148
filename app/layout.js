import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';

export const metadata = {
  title: 'G148 — Geração 148',
  description: 'Comunidade G148 Itumbiara: Mural, missões, oração e ranking.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport = {
  themeColor: '#3F2C1C',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Esse aviso do linter ("no-page-custom-font") foi escrito pensando no Pages
          Router antigo, onde existia um pages/_document.js separado. No App Router
          (o que este projeto usa), este app/layout.js já envolve TODAS as páginas,
          então carregar a fonte aqui é o padrão correto, não um problema.
        */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="G148" />
      </head>
      <body className="font-body">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
