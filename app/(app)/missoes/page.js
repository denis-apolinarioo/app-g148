'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, ListChecks } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import MissionCard from '@/components/MissionCard';
import MissionSubmitModal from '@/components/MissionSubmitModal';
import StreakBadge from '@/components/StreakBadge';
import EmptyState from '@/components/EmptyState';
import { getMissoesPorCategoria } from '@/lib/missionsRepo';
import { calcularCicloAtual, getStatusMissoesNoCiclo } from '@/lib/missionCycles';

export default function MissoesPage() {
  const { perfil } = useAuth();
  const [carregandoMissoes, setCarregandoMissoes] = useState(true);
  const [missoesExclusivas, setMissoesExclusivas] = useState([]);
  const [missoesGerais, setMissoesGerais] = useState([]);
  const [status, setStatus] = useState({});
  const [missaoAtiva, setMissaoAtiva] = useState(null);

  // Busca as missões (agora vêm do Firestore, coleção "missoes" — o Admin
  // pode criar/editar/apagar pelo próprio painel, sem precisar de deploy).
  // Só entram na lista as que já começaram e ainda não encerraram (ver
  // calcularCicloAtual) — uma missão sem repetição automática cujo período
  // já passou some sozinha daqui, sem o Admin precisar desativar à mão.
  useEffect(() => {
    Promise.all([
      getMissoesPorCategoria('exclusiva'),
      getMissoesPorCategoria('geral'),
    ]).then(([exclusivas, gerais]) => {
      const visivelPara = (missao) =>
        calcularCicloAtual(missao) !== null &&
        (!Array.isArray(missao.destinatarios) ||
          missao.destinatarios.length === 0 ||
          missao.destinatarios.includes(perfil.uid));

      setMissoesExclusivas(exclusivas.filter(visivelPara));
      setMissoesGerais(gerais.filter(visivelPara));
      setCarregandoMissoes(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carregarStatus = useCallback(async () => {
    if (!perfil) return;
    const todas = [...missoesExclusivas, ...missoesGerais];
    const novoStatus = await getStatusMissoesNoCiclo(perfil.uid, todas);
    setStatus(novoStatus);
  }, [perfil, missoesExclusivas, missoesGerais]);

  useEffect(() => {
    if (!carregandoMissoes) carregarStatus();
  }, [carregandoMissoes, carregarStatus]);

  function abrirMissao(missao) {
    setMissaoAtiva(missao);
  }

  const todasVisiveis = [...missoesExclusivas, ...missoesGerais];
  const cumpridas = todasVisiveis.filter((m) => status[m.id]?.esgotada).length;

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Missões" />

      <div className="space-y-6 px-4 py-4">
        <div className="flex items-center justify-between rounded-xl2 border border-coffee-100 bg-cream-card px-4 py-3.5 shadow-card">
          <div>
            <p className="text-xs font-medium text-coffee-400">Progresso</p>
            <p className="font-destaque text-lg font-semibold text-coffee-800">
              {cumpridas} de {todasVisiveis.length} cumpridas
            </p>
          </div>
          <StreakBadge dias={perfil?.streakAtual || 0} tamanho="lg" />
        </div>

        {carregandoMissoes ? (
          <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />
        ) : (
          <>
            <Secao titulo="Missões Exclusivas" subtitulo="Só pra quem foi convidado" icone={Sparkles}>
              {missoesExclusivas.length === 0 ? (
                <EmptyState icone={Sparkles} titulo="Nenhuma missão exclusiva por enquanto" />
              ) : (
                missoesExclusivas.map((missao) => (
                  <MissionCard
                    key={missao.id}
                    missao={missao}
                    concluida={!!status[missao.id]?.esgotada}
                    progresso={status[missao.id]}
                    onClick={abrirMissao}
                  />
                ))
              )}
            </Secao>

            <Secao titulo="Missões Gerais" subtitulo="Pra todo mundo" icone={ListChecks}>
              {missoesGerais.length === 0 ? (
                <EmptyState icone={ListChecks} titulo="Nenhuma missão geral por enquanto" />
              ) : (
                missoesGerais.map((missao) => (
                  <MissionCard
                    key={missao.id}
                    missao={missao}
                    concluida={!!status[missao.id]?.esgotada}
                    progresso={status[missao.id]}
                    onClick={abrirMissao}
                  />
                ))
              )}
            </Secao>
          </>
        )}
      </div>

      {missaoAtiva && (
        <MissionSubmitModal
          missao={missaoAtiva}
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
