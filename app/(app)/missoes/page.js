'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ListChecks } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import MissionCard from '@/components/MissionCard';
import MissionSubmitModal from '@/components/MissionSubmitModal';
import MissaoEnvioListaModal from '@/components/MissaoEnvioListaModal';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';
import StreakBadge from '@/components/StreakBadge';
import EmptyState from '@/components/EmptyState';
import { getMissoesPorCategoria } from '@/lib/missionsRepo';
import { calcularCicloAtual, getStatusMissoesNoCiclo, getSubmissoesDoCicloComPost } from '@/lib/missionCycles';
import { dentroDaJanelaHorario } from '@/lib/dateUtils';

export default function MissoesPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const [carregandoMissoes, setCarregandoMissoes] = useState(true);
  const [missoesExclusivas, setMissoesExclusivas] = useState([]);
  const [missoesGerais, setMissoesGerais] = useState([]);
  const [status, setStatus] = useState({});
  const [missaoAtiva, setMissaoAtiva] = useState(null);
  // Botão de "encaminhar" do MissionCard — enquanto busca os envios já
  // feitos no período (missaoId), ou já com a lista pronta pra escolher
  // ({ missao, submissoes }) quando há mais de um envio no período.
  const [missaoBuscandoEnvios, setMissaoBuscandoEnvios] = useState(null);
  const [listaEnviosParaEscolher, setListaEnviosParaEscolher] = useState(null);

  // PUBLICAÇÃO OTIMISTA — ver comentário grande em handleConfirmar de
  // MissionSubmitModal.js. `missoesOtimistas` guarda os IDs de missão "em
  // voo" (já aparecem concluídas na tela, mas o envio de verdade ainda
  // está rodando em segundo plano). `rascunhoMissao` guarda a resposta que
  // a pessoa tinha preenchido, pra reabrir o modal com tudo de volta se o
  // envio falhar. `conquistaParaMostrar` é a conquista destravada
  // descoberta depois que o modal já tinha fechado — o pop-up de
  // parabéns aparece por cima da tela de Missões nesse caso.
  const [missoesOtimistas, setMissoesOtimistas] = useState({});
  const [rascunhoMissao, setRascunhoMissao] = useState(null);
  const [conquistaParaMostrar, setConquistaParaMostrar] = useState(null);

  const handleEnviarOtimista = useCallback((missaoId) => {
    setMissoesOtimistas((m) => ({ ...m, [missaoId]: true }));
  }, []);

  const handleConfirmarEnviada = useCallback((missaoId, conquistaNova) => {
    setMissoesOtimistas((m) => {
      const { [missaoId]: _removida, ...resto } = m;
      return resto;
    });
    if (conquistaNova) setConquistaParaMostrar({ ...conquistaNova, desbloqueada: true });
  }, []);

  const handleErroEnviar = useCallback((missao, rascunho, mensagemErro) => {
    setMissoesOtimistas((m) => {
      const { [missao.id]: _removida, ...resto } = m;
      return resto;
    });
    setRascunhoMissao({ ...rascunho, mensagemErro });
    setMissaoAtiva(missao);
  }, []);

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
          missao.destinatarios.includes(perfil.uid)) &&
        (!missao.horarioAtivo || dentroDaJanelaHorario(missao.horarioInicio, missao.horarioFim));

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
    setRascunhoMissao(null);
    setMissaoAtiva(missao);
  }

  // Botão de "encaminhar" — leva direto pro post já feito nesta missão, no
  // período atual. Com 1 envio só, vai direto; com mais de 1 (missão que
  // pode ser cumprida várias vezes por período), abre a listinha pra
  // escolher qual dos posts ver, do mais recente pro mais antigo.
  async function encaminharParaEnvioAnterior(missao) {
    if (missaoBuscandoEnvios) return;
    setMissaoBuscandoEnvios(missao.id);
    try {
      const submissoes = await getSubmissoesDoCicloComPost(perfil.uid, missao);
      if (submissoes.length === 0) return; // nada pra encaminhar (raro — status já teria escondido o botão)
      if (submissoes.length === 1) {
        router.push(`/post/${submissoes[0].postId}`);
        return;
      }
      setListaEnviosParaEscolher({ missao, submissoes });
    } catch (err) {
      console.error('Erro ao buscar envios anteriores da missão:', err);
    } finally {
      setMissaoBuscandoEnvios(null);
    }
  }

  const todasVisiveis = [...missoesExclusivas, ...missoesGerais];
  const cumpridas = todasVisiveis.filter((m) => status[m.id]?.esgotada).length;

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar titulo="Missões" />

      <div className="space-y-6 px-4 py-4">
        <div className="flex items-center justify-between rounded-xl2 bg-cream-card px-4 py-3.5 shadow-flutuante">
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
            <Secao titulo="Missões Personalizadas" subtitulo="Só pra quem foi convidado" icone={Sparkles}>
              {missoesExclusivas.length === 0 ? (
                <EmptyState titulo="Nenhuma missão personalizada por enquanto" compacto textoPequeno />
              ) : (
                missoesExclusivas.map((missao) => (
                  <MissionCard
                    key={missao.id}
                    missao={missao}
                    concluida={!!status[missao.id]?.esgotada}
                    enviando={!!missoesOtimistas[missao.id]}
                    progresso={status[missao.id]}
                    onClick={abrirMissao}
                    onEncaminhar={encaminharParaEnvioAnterior}
                  />
                ))
              )}
            </Secao>

            <Secao titulo="Missões Gerais" subtitulo="Pra todo mundo" icone={ListChecks}>
              {missoesGerais.length === 0 ? (
                <EmptyState icone={ListChecks} titulo="Nenhuma missão geral por enquanto" compacto textoPequeno />
              ) : (
                missoesGerais.map((missao) => (
                  <MissionCard
                    key={missao.id}
                    missao={missao}
                    concluida={!!status[missao.id]?.esgotada}
                    enviando={!!missoesOtimistas[missao.id]}
                    progresso={status[missao.id]}
                    onClick={abrirMissao}
                    onEncaminhar={encaminharParaEnvioAnterior}
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
          onFechar={() => {
            setMissaoAtiva(null);
            setRascunhoMissao(null);
          }}
          onConcluida={carregarStatus}
          rascunhoInicial={rascunhoMissao?.missaoId === missaoAtiva.id ? rascunhoMissao : null}
          onEnviarOtimista={handleEnviarOtimista}
          onConfirmarEnviada={handleConfirmarEnviada}
          onErroEnviar={(missao, rascunho, mensagemErro) =>
            handleErroEnviar(missao, { ...rascunho, missaoId: missao.id }, mensagemErro)
          }
        />
      )}

      {conquistaParaMostrar && (
        <ConquistaDetalheModal
          conquista={conquistaParaMostrar}
          uid={perfil.uid}
          onFechar={() => setConquistaParaMostrar(null)}
        />
      )}

      {listaEnviosParaEscolher && (
        <MissaoEnvioListaModal
          titulo={listaEnviosParaEscolher.missao.titulo}
          submissoes={listaEnviosParaEscolher.submissoes}
          onEscolher={(submissao) => {
            setListaEnviosParaEscolher(null);
            router.push(`/post/${submissao.postId}`);
          }}
          onFechar={() => setListaEnviosParaEscolher(null)}
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
