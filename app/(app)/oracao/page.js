'use client';

import { useEffect, useState } from 'react';
import { Plus, HandHeart } from 'lucide-react';
import TopBar from '@/components/TopBar';
import PrayerCard from '@/components/PrayerCard';
import CreatePrayerModal from '@/components/CreatePrayerModal';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToPrayers } from '@/lib/firestore-helpers';

export default function OracaoPage() {
  const { perfil } = useAuth();
  const [pedidos, setPedidos] = useState(null);
  const [criando, setCriando] = useState(false);
  const [filtro, setFiltro] = useState('ativos'); // ativos | todos

  useEffect(() => {
    const unsub = subscribeToPrayers(setPedidos);
    return () => unsub();
  }, []);

  // Mesmo padrão do Feed (app/(app)/feed/page.js) — pedido oculto some do
  // mural de todo mundo, exceto do próprio dono (placeholder, ver
  // PrayerCard.js) e do Admin (sempre vê tudo).
  const listaFiltrada = pedidos
    ?.filter((p) => !p.oculto || p.autorId === perfil?.uid || perfil?.isAdmin)
    .filter((p) => (filtro === 'ativos' ? p.status === 'ativo' : true));

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar
        titulo="Oração"
        acao={
          <button
            onClick={() => setCriando(true)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-forte text-texto-forte"
          >
            <Plus size={16} />
          </button>
        }
      />

      <div className="px-4 py-4">
        <div className="mb-4 flex gap-2">
          <FiltroBtn ativo={filtro === 'ativos'} onClick={() => setFiltro('ativos')} label="Ativos" />
          <FiltroBtn ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} label="Todos" />
        </div>

        {pedidos === null && (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-28 animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        )}

        {listaFiltrada?.length === 0 && (
          <EmptyState
            icone={HandHeart}
            titulo="Nenhum pedido por aqui"
            descricao="Compartilhe um pedido ou agradecimento com a comunidade."
          />
        )}

        <div className="space-y-3 pb-6">
          {listaFiltrada?.map((pedido) => (
            <PrayerCard key={pedido.id} pedido={pedido} />
          ))}
        </div>
      </div>

      {criando && <CreatePrayerModal onFechar={() => setCriando(false)} />}
    </div>
  );
}

function FiltroBtn({ ativo, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-4 py-1.5 text-xs font-semibold ${
        ativo ? 'bg-forte text-texto-forte' : 'bg-coffee-50 text-coffee-500'
      }`}
    >
      {label}
    </button>
  );
}
