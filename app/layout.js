import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import { ConfirmProvider } from '@/components/ConfirmProvider';
import { ToastProvider } from '@/components/ToastProvider';

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
  themeColor: '#FAF6EF',
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
          Cor do app (aba Estética do Admin) — aplica as variáveis CSS do
          preset ANTES da 1ª pintura da tela (script síncrono no <head>,
          roda antes do React hidratar). Sem isso, quem tem um preset
          diferente do "Claro" (o padrão embutido no CSS) veria a tela com
          a cor errada piscar por uma fração de segundo a cada abertura.
          Lê o preset já cacheado em localStorage por lib/theme.js (ver
          `CHAVE_CACHE`/`salvarCache`) — se ainda não existe cache nenhum
          (1ª visita), não faz nada extra: os valores padrão já escritos em
          :root (app/globals.css) são exatamente o preset "Claro", então a
          tela já nasce certa mesmo sem esse script rodar.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{
  var bruto=localStorage.getItem('g148_preset_ativo');
  if(!bruto)return;
  var cache=JSON.parse(bruto);
  var p=cache&&cache.preset;
  if(!p||!p.variaveis)return;
  var mapa={cream:'--cor-cream',creamSoft:'--cor-cream-soft',creamCard:'--cor-cream-card',coffee50:'--cor-coffee-50',coffee100:'--cor-coffee-100',coffee200:'--cor-coffee-200',coffee300:'--cor-coffee-300',coffee400:'--cor-coffee-400',coffee500:'--cor-coffee-500',coffee600:'--cor-coffee-600',coffee700:'--cor-coffee-700',coffee800:'--cor-coffee-800',coffee900:'--cor-coffee-900',forte:'--cor-forte',forte800:'--cor-forte-800',forte900:'--cor-forte-900',gold:'--cor-gold',goldSoft:'--cor-gold-soft'};
  var raiz=document.documentElement;
  Object.keys(mapa).forEach(function(chave){
    var hex=p.variaveis[chave];
    if(!hex)return;
    var r=parseInt(hex.substring(1,3),16),g=parseInt(hex.substring(3,5),16),b=parseInt(hex.substring(5,7),16);
    raiz.style.setProperty(mapa[chave], r+' '+g+' '+b);
  });
  if(p.ehEscuro){
    raiz.classList.add('dark');
    var m=document.querySelector('meta[name="theme-color"]');
    if(m&&p.variaveis.cream)m.setAttribute('content',p.variaveis.cream);
  }
}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-body">
        <AuthProvider>
          <ConfirmProvider>
            <ToastProvider>{children}</ToastProvider>
          </ConfirmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
