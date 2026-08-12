'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import { Settings, Crown, Wallet, Box } from 'lucide-react';
import MailboxLink from '@/components/MailboxLink';

// Item novo — useSearchParams() exige um <Suspense> em volta (Next 14),
// mesmo padrão já usado em app/(app)/carteira/page.js.
export default function MeuPerfilPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <MeuPerfilConteudo />
    </Suspense>
  );
}

function MeuPerfilConteudo() {
  const { perfil } = useAuth();
  // Item novo — chegando de uma notificação de conquista (?conquista=id),
  // já abre a aba certa com o emblema em destaque (ver ProfileView.js).
  const searchParams = useSearchParams();
  const conquistaId = searchParams.get('conquista');

  if (!perfil) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-2xl">
      {/* .barra-fade-tema: dá um fade próprio pra essa barra ao trocar
          tema (backdrop-blur não entra no cross-fade automático da View
          Transition — ver comentário da classe em globals.css),
          sincronizado com o resto da tela pela mesma variável de
          duração/curva — inclusive o ícone da coroa do Admin. */}
      <header className="barra-fade-tema sticky top-0 z-30 flex items-center justify-between border-b border-coffee-200 bg-cream/95 px-5 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <div>
          {/* Item novo (Bloco A) — acesso ao Admin movido pra ponta esquerda
              do cabeçalho, com o ícone de coroa no lugar do escudo. */}
          {perfil.isAdmin && (
            <Link href="/admin" className="text-gold">
              <Crown size={22} />
            </Link>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Seletor de tema e botão de sair mudaram pra dentro de Editar
              perfil (ícone de engrenagem abaixo) — cabeçalho ficou só com
              atalhos de navegação, não configuração. Ver
              app/(app)/perfil/editar/page.js. */}
          <MailboxLink size={21} />
          {/* Carteira subiu pra cá (perto dos outros ícones de configuração
              do cabeçalho) — o atalho e a página em si continuam iguais,
              só a localização mudou. */}
          <Link href="/carteira" className="text-coffee-500" aria-label="Carteira">
            <Wallet size={21} />
          </Link>
          {/* Item novo — caixa de Materiais (Bíblia, Spotify, Drive do
              livro do bimestre, PDFs de estudo etc.), cadastrados pelo
              Admin em Admin > Materiais. */}
          <Link href="/materiais" className="text-coffee-500" aria-label="Materiais">
            <Box size={21} />
          </Link>
          <Link href="/perfil/editar" className="text-coffee-500" aria-label="Editar perfil e configurações">
            <Settings size={21} />
          </Link>
        </div>
      </header>

      <ProfileView usuario={perfil} usuarioAtual={perfil} abrirConquistaId={conquistaId} />
    </div>
  );
}
