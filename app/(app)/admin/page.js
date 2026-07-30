'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import { ShieldAlert } from 'lucide-react';
import AbaAcoes from './_components/AbaAcoes';
import AbaMissoes from './_components/AbaMissoes';
import AbaUsuarios from './_components/AbaUsuarios';
import AbaDesafios from './_components/AbaDesafios';
import AbaCorreio from './_components/AbaCorreio';

const ABAS = ['Ações', 'Missões', 'Usuários', 'Desafios', 'Correio'];

export default function AdminPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState('Ações');

  useEffect(() => {
    if (perfil && !perfil.isAdmin) {
      router.replace('/feed');
    }
  }, [perfil, router]);

  if (!perfil) return <LoadingScreen />;
  if (!perfil.isAdmin) {
    return (
      <div className="mx-auto max-w-md">
        <TopBar titulo="Painel Admin" voltarPara="/perfil" />
        <EmptyState icone={ShieldAlert} titulo="Área restrita a administradores" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Painel Admin" voltarPara="/perfil" />

      <div className="flex gap-1.5 overflow-x-auto border-b border-coffee-100 px-4 pb-0.5 pt-3">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-shrink-0 rounded-t-lg border-b-2 px-3 pb-2.5 text-sm font-medium ${
              aba === a ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {aba === 'Ações' && <AbaAcoes />}
        {aba === 'Missões' && <AbaMissoes />}
        {aba === 'Usuários' && <AbaUsuarios />}
        {aba === 'Desafios' && <AbaDesafios />}
        {aba === 'Correio' && <AbaCorreio />}
      </div>
    </div>
  );
}
