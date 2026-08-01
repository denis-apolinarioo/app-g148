'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import { ShieldAlert } from 'lucide-react';
import AdminLoginGate from './_components/AdminLoginGate';
import AbaAcoes from './_components/AbaAcoes';
import AbaMissoes from './_components/AbaMissoes';
import AbaUsuarios from './_components/AbaUsuarios';
import AbaCorreio from './_components/AbaCorreio';
import AbaDenuncias from './_components/AbaDenuncias';
import AbaConfiguracoes from './_components/AbaConfiguracoes';
import AbaHistorico from './_components/AbaHistorico';

const ABAS = ['Ações', 'Missões', 'Usuários', 'Correio', 'Denúncias', 'Histórico', 'Config'];

export default function AdminPage() {
  const { usuarioAuth, perfil } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState('Ações');
  // Item 10 do Bloco 4: pede e-mail/senha toda vez que entra na área Admin.
  // Esse state nasce false toda vez que o componente é montado (ou seja,
  // toda vez que a pessoa entra em /admin de novo) — não é salvo em lugar
  // nenhum de propósito, pra pedir confirmação sempre, como pedido.
  const [desbloqueado, setDesbloqueado] = useState(false);

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

  if (!desbloqueado) {
    return (
      <div className="mx-auto max-w-md">
        <TopBar titulo="Painel Admin" voltarPara="/perfil" />
        <AdminLoginGate usuarioAuth={usuarioAuth} onDesbloqueado={() => setDesbloqueado(true)} />
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
        {aba === 'Correio' && <AbaCorreio />}
        {aba === 'Denúncias' && <AbaDenuncias />}
        {aba === 'Histórico' && <AbaHistorico />}
        {aba === 'Config' && <AbaConfiguracoes />}
      </div>
    </div>
  );
}
