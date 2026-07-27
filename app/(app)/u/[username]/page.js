'use client';

import { useEffect, useState } from 'react';
import { getUserByUsername } from '@/lib/firestore-helpers';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import { UserX } from 'lucide-react';

export default function PerfilPublicoPage({ params }) {
  const { username } = params;
  const { perfil } = useAuth();
  const router = useRouter();
  const [usuario, setUsuario] = useState(undefined); // undefined = carregando, null = não encontrado

  useEffect(() => {
    getUserByUsername(username).then(setUsuario);
  }, [username]);

  useEffect(() => {
    // Se a pessoa clicar no próprio nome em algum lugar do app, manda pro
    // /perfil de verdade (com botões de editar/sair), não pra essa versão
    // pública somente-leitura.
    if (usuario && perfil && usuario.uid === perfil.uid) {
      router.replace('/perfil');
    }
  }, [usuario, perfil, router]);

  if (usuario === undefined) return <LoadingScreen />;

  if (usuario === null) {
    return (
      <div className="mx-auto max-w-md">
        <TopBar titulo="Perfil" voltarPara="/feed" />
        <EmptyState icone={UserX} titulo="Perfil não encontrado" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo={`@${usuario.username}`} voltarPara="/feed" />
      <ProfileView usuario={usuario} />
    </div>
  );
}
