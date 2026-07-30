'use client';

import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import { Settings, Crown, LogOut } from 'lucide-react';
import MailboxLink from '@/components/MailboxLink';

export default function MeuPerfilPage() {
  const { perfil } = useAuth();

  if (!perfil) return <LoadingScreen />;

  async function handleSair() {
    if (confirm('Sair da sua conta?')) {
      await signOut(auth);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-coffee-100 bg-cream/95 px-5 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
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
          <MailboxLink size={21} />
          <Link href="/perfil/editar" className="text-coffee-500">
            <Settings size={21} />
          </Link>
          <button onClick={handleSair} className="text-coffee-500">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <ProfileView usuario={perfil} usuarioAtual={perfil} />
    </div>
  );
}
