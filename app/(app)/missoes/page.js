'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import MissionCard from '@/components/MissionCard';
import MissionSubmitModal from '@/components/MissionSubmitModal';
import StreakBadge from '@/components/StreakBadge';
import { getMissoesPorPeriodicidade } from '@/lib/missionsRepo';
import { getStatusMissoesDiariasHoje } from '@/lib/points';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { currentWeekId, currentMonthId } from '@/lib/dateUtils';

export default function MissoesPage() {
  const { perfil } = useAuth();
  const [carregandoMissoes, setCarregandoMissoes] = useState(true);
  const [missoesDiarias, setMissoesDiarias] = useState([]);
  const [missoesSemanais, setMissoesSemanais] = useState([]);
  const [missoesMensais, setMissoesMensais] = useState([]);
  const [statusDiarias, setStatusDiarias] = useState({});
  const [statusSemanais, setStatusSemanais] = useState({});
  const [statusMensais, setStatusMensais] = useState({});
  const [missaoAtiva, setMissaoAtiva] = useState(null);
  const [periodicidadeAtiva, setPeriodicidadeAtiva] = useState(null);

  // Busca as missões (agora vêm do Firestore, coleção "missoes" — o Admin
  // pode criar/editar/apagar pelo próprio painel, sem precisar de deploy)
  // O layout já garante que `perfil` está carregado antes desta página
  // renderizar (ver app/(app)/layout.js), então dá pra ler o uid aqui sem
  // precisar re-executar a busca das missões toda vez que `perfil` mudar
  // (ex.: quando os pontos são atualizados depois de submeter uma missão).
  useEffect(() => {
    Promise.all([
      getMissoesPorPeriodicidade('diaria'),
      getMissoesPorPeriodicidade('semanal'),
      getMissoesPorPeriodicidade('mensal'),
    ]).then(([diarias, semanais, mensais]) => {
      // Uma missão só é restrita quando `destinatarios` é um array não-vazio;
      // nesse caso, só aparece pra quem estiver na lista.
      const visivelPara = (missao) =>
        !Array.isArray(missao.destinatarios) ||
        missao.destinatarios.length === 0 ||
        missao.destinatarios.includes(perfil.uid);

      setMissoesDiarias(diarias.filter(visivelPara));
      setMissoesSemanais(semanais.filter(visivelPara));
      setMissoesMensais(mensais.filter(visivelPara));
      setCarregandoMissoes(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarStatus = useCallback(async () => {
    if (!perfil) return;

    const diarias = await getStatusMissoesDiariasHoje(perfil.uid);
    setStatusDiarias(diarias);

    const semana = currentWeekId();
    const semanais = {};
    await Promise.all(
      missoesSemanais.map(async (m) => {
        const snap = await getDoc(doc(db, 'missionSubmissions', `${perfil.uid}_${m.id}_${semana}`));
        semanais[m.id] = snap.exists();
      })
    );
    setStatusSemanais(semanais);

    const mes = currentMonthId();
    const mensais = {};
    await Promise.all(
      missoesMensais.map(async (m) => {
        const snap = await getDoc(doc(db, 'missionSubmissions', `${perfil.uid}_${m.id}_${mes}`));
        mensais[m.id] = snap.exists();
      })
    );
    setStatusMensais(mensais);
  }, [perfil, missoesSemanais, missoesMensais]);

  useEffect(() => {
    if (!carregandoMissoes) carregarStatus();
  }, [carregandoMissoes, carregarStatus]);

  function abrirMissao(missao, periodicidade) {
    setMissaoAtiva(missao);
    setPeriodicidadeAtiva(periodicidade);
  }

  const totalHoje = missoesDiarias.filter((m) => statusDiarias[m.id]).length;

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Missões" />

      <div className="space-y-6 px-4 py-4">
        <div className="flex items-center justify-between rounded-xl2 border border-coffee-100 bg-cream-card px-4 py-3.5 shadow-card">
          <div>
            <p className="text-xs font-medium text-coffee-400">Hoje</p>
            <p className="font-destaque text-lg font-semibold text-coffee-800">
              {totalHoje} de {missoesDiarias.length} cumpridas
            </p>
          </div>
          <StreakBadge dias={perfil?.streakAtual || 0} tamanho="lg" />
        </div>

        {carregandoMissoes ? (
          <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />
        ) : (
          <>
            <Secao titulo="Missões Diárias" subtitulo="Renovam à meia-noite">
              {missoesDiarias.map((missao) => (
                <MissionCard
                  key={missao.id}
                  missao={missao}
                  concluida={!!statusDiarias[missao.id]}
                  onClick={(m) => abrirMissao(m, 'diaria')}
                />
              ))}
            </Secao>

            <Secao titulo="Missões Semanais" subtitulo="Renovam toda semana">
              {missoesSemanais.map((missao) => (
                <MissionCard
                  key={missao.id}
                  missao={missao}
                  concluida={!!statusSemanais[missao.id]}
                  onClick={(m) => abrirMissao(m, 'semanal')}
                />
              ))}
            </Secao>

            <Secao titulo="Missões do Mês" subtitulo="Desafios de mais fôlego">
              {missoesMensais.map((missao) => (
                <MissionCard
                  key={missao.id}
                  missao={missao}
                  concluida={!!statusMensais[missao.id]}
                  onClick={(m) => abrirMissao(m, 'mensal')}
                />
              ))}
            </Secao>
          </>
        )}
      </div>

      {missaoAtiva && (
        <MissionSubmitModal
          missao={missaoAtiva}
          periodicidade={periodicidadeAtiva}
          onFechar={() => setMissaoAtiva(null)}
          onConcluida={carregarStatus}
        />
      )}
    </div>
  );
}

function Secao({ titulo, subtitulo, children }) {
  return (
    <section>
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 className="font-destaque text-base font-semibold text-coffee-800">{titulo}</h2>
        <span className="text-xs text-coffee-300">{subtitulo}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
