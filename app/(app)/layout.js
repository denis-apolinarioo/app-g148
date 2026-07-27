'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import BottomNav from '@/components/BottomNav';

export default function AppLayout({ children }) {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;
    if (!usuarioAuth) {
      router.replace('/login');
    } else if (!perfil) {
      router.replace('/onboarding');
    }
  }, [carregando, usuarioAuth, perfil, router]);

  if (carregando || !usuarioAuth || !perfil) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-cream pb-20">
      {children}
      <BottomNav />
    </div>
  );
}
