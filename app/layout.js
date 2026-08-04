import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';

export const metadata = {
  title: 'G148 — Geração 148',
  description: 'Comunidade G148 Itumbiara: Feed, missões, oração e ranking.',
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
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="G148" />
        {/*
          Modo escuro — aplica a classe `dark` na tag <html> ANTES da 1ª
          pintura da tela (script síncrono no <head>, roda antes do React
          hidratar). Sem isso, quem prefere escuro veria a tela clara piscar
          por uma fração de segundo a cada abertura do app. Lê a escolha
          salva; se a pessoa nunca escolheu, segue a preferência do sistema.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('g148_tema');if(!t){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'escuro':'claro';}if(t==='escuro'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body">
        <AuthProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
