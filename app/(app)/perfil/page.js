'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { useSearchParams } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import { Settings, Crown, LogOut, Sun, Moon, Wallet } from 'lucide-react';
import MailboxLink from '@/components/MailboxLink';
import { limparTokenAoSair } from '@/lib/push';
import { useTema } from '@/lib/theme';
import { useConfirm } from '@/components/ConfirmProvider';

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
  const [tema, alternarTema] = useTema();
  const confirmar = useConfirm();
  // Item novo — chegando de uma notificação de conquista (?conquista=id),
  // já abre a aba certa com o emblema em destaque (ver ProfileView.js).
  const searchParams = useSearchParams();
  const conquistaId = searchParams.get('conquista');

  if (!perfil) return <LoadingScreen />;

  async function handleSair() {
    const ok = await confirmar({ titulo: 'Sair da sua conta?', labelConfirmar: 'Sair' });
    if (ok) {
      // Item 25 do Bloco 10 — remove o token de push deste aparelho ANTES
      // de sair, senão quem ficar logado em outra conta nesse mesmo
      // navegador continuaria recebendo pushes da conta anterior.
      await limparTokenAoSair();
      await signOut(auth);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* .barra-fade-tema: dá um fade próprio pra essa barra ao trocar
          tema (backdrop-blur não entra no cross-fade automático da View
          Transition — ver comentário da classe em globals.css),
          sincronizado com o resto da tela pela mesma variável de
          duração/curva — inclusive os ícones (coroa do Admin, sol/lua). */}
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
          <button
            onClick={alternarTema}
            className="text-coffee-500"
            aria-label={tema === 'escuro' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
          >
            {tema === 'escuro' ? <Sun size={21} /> : <Moon size={21} />}
          </button>
          <MailboxLink size={21} />
          {/* Carteira subiu pra cá (perto dos outros ícones de configuração
              do cabeçalho) — o atalho e a página em si continuam iguais,
              só a localização mudou. */}
          <Link href="/carteira" className="text-coffee-500" aria-label="Carteira">
            <Wallet size={21} />
          </Link>
          <Link href="/perfil/editar" className="text-coffee-500">
            <Settings size={21} />
          </Link>
          <button onClick={handleSair} className="text-coffee-500">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <ProfileView usuario={perfil} usuarioAtual={perfil} abrirConquistaId={conquistaId} />
    </div>
  );
}
