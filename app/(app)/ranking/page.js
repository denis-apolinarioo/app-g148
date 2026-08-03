'use client';

import { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import RankingRow from '@/components/RankingRow';
import EmptyState from '@/components/EmptyState';
import { Trophy } from 'lucide-react';
import { reportarConexaoOk, reportarErroConexao } from '@/lib/connectivity';
import { atualizarStreakTop1 } from '@/lib/rankingStreak';

export default function RankingPage() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    // NOTA DE ESCALA (registrado no relatório técnico, não é bug — só
    // registro pra quem for mexer aqui depois): essa consulta escuta a
    // coleção `users` inteira, ordenada por pontos, sem `limit()` — ou seja,
    // toda a comunidade fica em tempo real na tela de Ranking. Isso é
    // intencional pro cenário atual (25-50 pessoas): a ideia é mostrar o
    // ranking completo, não só um top N. Só viraria problema de
    // performance/custo (leituras do Firestore) se a comunidade crescer bem
    // além disso. Se algum dia isso importar, a solução é adicionar um
    // `limit()` com paginação — não mudar a lógica de ranking em si.
    const q = query(collection(db, 'users'), orderBy('pontos', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        reportarConexaoOk();
        setUsuarios(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error('[RankingPage] Erro na escuta em tempo real:', err);
        reportarErroConexao();
      }
    );
    return () => unsub();
  }, []);

  const minhaPosicao = usuarios?.findIndex((u) => u.id === perfil?.uid);
  const estouEm1Lugar = minhaPosicao === 0;

  // CONQUISTA "Planando como Águia" — checagem por dia, não em tempo real
  // (ver comentário de limitação em lib/rankingStreak.js). Só dispara
  // quando o status de "estar em 1º" muda de fato (não a cada tick do
  // ranking em tempo real).
  useEffect(() => {
    if (!perfil?.uid || minhaPosicao === undefined || minhaPosicao === -1) return;
    atualizarStreakTop1(perfil.uid, estouEm1Lugar).catch((err) => {
      console.error('Erro ao atualizar streak de 1º lugar:', err);
    });
  }, [perfil?.uid, estouEm1Lugar]);

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
