'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';

export default function RootPage() {
  const { usuarioAuth, perfil, carregando } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (carregando) return;

    if (!usuarioAuth) {
      router.replace('/login');
    } else if (!perfil) {
      router.replace('/onboarding');
    } else {
      router.replace('/feed');
    }
  }, [carregando, usuarioAuth, perfil, router]);

  return <LoadingScreen />;
}
