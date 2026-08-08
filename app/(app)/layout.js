'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import BottomNav from '@/components/BottomNav';
import ConexaoBanner from '@/components/ConexaoBanner';
import { processarFilaOffline } from '@/lib/offlineQueue';
import { useSwipeNavigation } from '@/lib/useSwipeNavigation';
import { ABAS_PRINCIPAIS } from '@/lib/constants';
import { Lock } from 'lucide-react';
import { useSincronizarBarrinha } from '@/lib/theme';

export default function AppLayout({ children }) {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const swipeHandlers = useSwipeNavigation();
  useSincronizarBarrinha();

  // Compara o pathname anterior com o atual DURANTE a renderização (padrão
  // recomendado pelo React pra "ajustar estado quando uma prop muda", em vez
  // de useEffect) pra decidir o lado de onde a próxima tela desliza: se as
  // duas telas são abas principais, "pra frente" (índice maior na
  // BottomNav) desliza da direita, "pra trás" desliza da esquerda. Fora das
  // abas principais (detalhe de post, Admin, Correio etc.) cai na animação
  // antiga (fade).
  const [pathnameAnterior, setPathnameAnterior] = useState(pathname);
  const [classeEntrada, setClasseEntrada] = useState('entrada-aba');

  if (pathname !== pathnameAnterior) {
    const indiceAnterior = ABAS_PRINCIPAIS.findIndex((aba) => aba.href === pathnameAnterior);
    const indiceAtual = ABAS_PRINCIPAIS.findIndex((aba) => aba.href === pathname);
    setClasseEntrada(
      indiceAnterior !== -1 && indiceAtual !== -1
        ? (indiceAtual > indiceAnterior ? 'entrada-aba-frente' : 'entrada-aba-voltar')
        : 'entrada-aba'
    );
    setPathnameAnterior(pathname);
  }

  useEffect(() => {
    if (carregando) return;
    if (!usuarioAuth) {
      router.replace('/login');
    } else if (!perfil) {
      router.replace('/onboarding');
    }
  }, [carregando, usuarioAuth, perfil, router]);

  // Item 16 do Bloco 8 — se o app abrir já com internet e sobrou alguma
  // ação da última vez que ficou offline, tenta reprocessar a fila aqui.
  // A reconexão *durante* o uso já é tratada dentro do próprio
  // lib/offlineQueue.js (aoReconectar), sem precisar disso de novo.
  useEffect(() => {
    if (usuarioAuth) processarFilaOffline();
  }, [usuarioAuth]);

  if (carregando || !usuarioAuth || !perfil) {
    return <LoadingScreen />;
  }

  // Item 13 do Bloco 6 — `perfil` vem de um listener em tempo real
  // (subscribeToUserProfile no AuthProvider), então assim que o Admin trava
  // alguém, `perfil.travado` vira true e essa tela aparece NA HORA, mesmo
  // que a pessoa já estivesse com o app aberto — sem precisar deslogar nem
  // recarregar a página pra o bloqueio valer.
  if (perfil.travado) {
    return <ContaTravada />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream pb-20" {...swipeHandlers}>
      <ConexaoBanner />
      {/* `key={pathname}` força o React a remontar esse wrapper a cada troca
          de aba — é o que faz a animação de entrada (definida em
          globals.css) tocar de novo em toda navegação, seja por swipe ou
          pelo toque normal na BottomNav. Entre as 5 abas principais a classe
          é escolhida acima (entrada-aba-frente/-voltar) pra deslizar do lado
          certo; fora delas cai no fade antigo (entrada-aba). */}
      <div key={pathname} className={classeEntrada}>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}

function ContaTravada() {
  async function handleSair() {
    await signOut(auth);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-coffee-700">
        <Lock size={26} className="text-cream" />
      </div>
      <h1 className="font-destaque text-lg font-semibold text-coffee-800">Acesso travado</h1>
      <p className="mt-2 max-w-xs text-sm text-coffee-400">
        Seu acesso ao app foi travado temporariamente por um administrador. Fale com a liderança
        da G148 se achar que isso é um engano.
      </p>
      <button
        onClick={handleSair}
        className="mt-6 rounded-xl border border-coffee-100 px-5 py-2.5 text-sm font-semibold text-coffee-600"
      >
        Sair da conta
      </button>
    </div>
  );
}
