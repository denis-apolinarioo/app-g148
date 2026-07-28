import './globals.css';
import { AuthProvider } from '@/components/AuthProvider';
import SplashScreen from '@/components/SplashScreen';

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
  themeColor: '#5B3A29', 
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
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="G148" />
      </head>
      <body className="font-body">
        <AuthProvider>
          <SplashScreen />
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
