'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import RankingRow from '@/components/RankingRow';
import EmptyState from '@/components/EmptyState';
import { Trophy } from 'lucide-react';

export default function RankingPage() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('pontos', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const minhaPosicao = usuarios?.findIndex((u) => u.id === perfil?.uid);

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Ranking" />

      <div className="px-4 py-4">
        <div className="mb-5 rounded-xl2 bg-coffee-700 px-5 py-5 text-center shadow-soft">
          <p className="text-xs font-medium uppercase tracking-wide text-coffee-200">Sua posição</p>
          <p className="mt-1 font-destaque text-3xl font-bold text-cream">
            {minhaPosicao >= 0 ? `${minhaPosicao + 1}º` : '—'}
          </p>
          <p className="mt-1 text-sm text-coffee-200">{perfil?.pontos || 0} pontos</p>
        </div>

        {usuarios === null && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        )}

        {usuarios?.length === 0 && (
          <EmptyState icone={Trophy} titulo="Ninguém pontuou ainda" />
        )}

        <div className="space-y-2 pb-6">
          {usuarios?.map((usuario, i) => (
            <RankingRow
              key={usuario.id}
              posicao={i + 1}
              usuario={usuario}
              souEu={usuario.id === perfil?.uid}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
