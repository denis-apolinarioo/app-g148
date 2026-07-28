'use client';

import Link from 'next/link';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import ProfileView from '@/components/ProfileView';
import LoadingScreen from '@/components/LoadingScreen';
import { Settings, Mailbox, ShieldCheck, LogOut } from 'lucide-react';

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
      <header className="sticky top-0 z-30 flex items-center justify-end gap-4 border-b border-coffee-100 bg-cream/95 px-5 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
        <Link href="/correio" className="text-coffee-500">
          <Mailbox size={21} />
        </Link>
        {perfil.isAdmin && (
          <Link href="/admin" className="text-coffee-500">
            <ShieldCheck size={21} />
          </Link>
        )}
        <Link href="/perfil/editar" className="text-coffee-500">
          <Settings size={21} />
        </Link>
        <button onClick={handleSair} className="text-coffee-500">
          <LogOut size={20} />
        </button>
      </header>

      <ProfileView usuario={perfil} usuarioAtual={perfil} />
    </div>
  );
}
