'use client';

import { useEffect, useState } from 'react';
import { getUserByUsername } from '@/lib/firestore-helpers';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import { UserX, WifiOff } from 'lucide-react';

// estados possíveis de `usuario`: undefined = carregando, null = não existe
// de fato, 'erro' = falha de rede/permissão (bem diferente de "não existe"!)
export default function PerfilPublicoPage({ params }) {
  const { username } = params;
  const { perfil } = useAuth();
  const router = useRouter();
  const [usuario, setUsuario] = useState(undefined);

  useEffect(() => {
    let ativo = true;
    setUsuario(undefined);

    getUserByUsername(username)
      .then((resultado) => {
        if (ativo) setUsuario(resultado);
      })
      .catch((err) => {
        // CORREÇÃO DE BUG: antes, um erro de rede/permissão não era tratado
        // aqui — a tela ficava travada carregando pra sempre, ou em algum
        // caso confuso podia parecer "perfil não encontrado" sem ser esse
        // o problema real. Agora diferenciamos claramente os dois casos.
        console.error('Erro ao buscar perfil por username:', err);
        if (ativo) setUsuario('erro');
      });

    return () => {
      ativo = false;
    };
  }, [username]);

  useEffect(() => {
    // Se a pessoa clicar no próprio nome em algum lugar do app, manda pro
    // /perfil de verdade (com botões de editar/sair), não pra essa versão
    // pública somente-leitura.
    if (usuario && usuario !== 'erro' && perfil && usuario.uid === perfil.uid) {
      router.replace('/perfil');
    }
  }, [usuario, perfil, router]);

  if (usuario === undefined) return <LoadingScreen />;

  if (usuario === 'erro') {
    return (
      <div className="mx-auto max-w-2xl">
        <TopBar titulo="Perfil" voltarPara="/feed" />
        <EmptyState
          icone={WifiOff}
          titulo="Não foi possível carregar"
          descricao="Verifique sua internet e tente novamente em instantes."
        />
      </div>
    );
  }

  if (usuario === null) {
    return (
      <div className="mx-auto max-w-2xl">
        <TopBar titulo="Perfil" voltarPara="/feed" />
        <EmptyState icone={UserX} titulo="Perfil não encontrado" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar titulo={`@${usuario.username}`} voltarPara="/feed" />
      <ProfileView usuario={usuario} usuarioAtual={perfil} />
    </div>
  );
}
