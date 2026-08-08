'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Users,
  UserCheck,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  getTodasAsConquistas,
  criarConquista,
  atualizarConquista,
  apagarConquista,
  trocarOrdem,
  reordenarConquistas,
  migrarConquistasNovasParaFirestore,
} from '@/lib/conquistasRepo';
import { getTodasAsMissoes } from '@/lib/missionsRepo';
import { getTodasAsCategoriasAcao } from '@/lib/categoriasAcaoRepo';
import { getConquistasDoUsuario, concederConquistaManualmente } from '@/lib/achievements';
import { getAllUsers } from '@/lib/firestore-helpers';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { uploadImagemConquista } from '@/lib/storage';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import IconGalleryPicker from '@/components/IconGalleryPicker';
import ImageCropper from '@/components/ImageCropper';
import EmblemaConquista from '@/components/EmblemaConquista';
import { EMBLEMAS, caminhoEmblema } from '@/lib/emblemas';
import BuscaUsuario from './BuscaUsuario';
import { useArrastarReordenar } from './useArrastarReordenar';

// Cada opção corresponde a um contadorTipo (ver lib/achievements.js). As
// opções "missao" e "categoria" são especiais: o valor final salvo vira
// "missao:<id da missão>" ou "categoria:<id da categoria>" (ver
// montarContadorTipo/desmontarContadorTipo abaixo). "categoria" é a Fase 2
// (Admin > Ações > Ações específicas) — conta quantas vezes a pessoa fez
// aquela categoria.
const TIPOS_CONTADOR = [
  { valor: 'streak', label: 'Sequência de dias ativos (streak)' },
  { valor: 'oracao', label: 'Orações (pedidos orados pela pessoa)' },
  { valor: 'post', label: 'Posts publicados no Feed' },
  { valor: 'missao', label: 'Quantidade de vezes que cumpriu uma missão específica' },
  { valor: 'categoria', label: 'Quantidade de vezes que usou uma categoria de ação específica' },
  { valor: 'dracma_saldo', label: 'Saldo atual de Dracma' },
  { valor: 'dracma_enviado:qtd', label: 'Dracma enviado (quantidade de transferências)' },
  { valor: 'dracma_recebido:qtd', label: 'Dracma recebido (quantidade de transferências)' },
  { valor: 'dracma_ganho_total', label: 'Dracma total ganho (histórico, desde sempre)' },
  // ---- adicionados junto com o bloco "25 conquistas novas" ----
  // Os 3 com número embutido no valor (curtidas_por_post:10,
  // categoria_audio_min:musica:60, pedido_e_oracoes:10) usam o MESMO número
  // pros 3 níveis I/II/III — o que muda de nível pra nível é o campo "Meta"
  // (quantos posts/vezes), não esse número embutido. Pra mudar o número
  // embutido (ex.: exigir 15 curtidas por post em vez de 10), é preciso
  // apagar e recriar a conquista com um contador diferente — não editável
  // por aqui.
  { valor: 'curtidas_por_post:10', label: 'Posts próprios que bateram 10 curtidas' },
  { valor: 'curtidas_dadas', label: 'Curtidas dadas (em posts diferentes)' },
  { valor: 'comentarios', label: 'Comentários feitos' },
  { valor: 'dias_3_oracoes', label: 'Dias com as 3 orações diárias no mesmo dia' },
  { valor: 'categoria_audio_min:musica:60', label: 'Posts c/ áudio 1min+ na categoria "musica"' },
  { valor: 'oracao_audio', label: 'Orações diárias enviadas com áudio' },
  { valor: 'madrugada_oracao', label: 'Orações diárias feitas de madrugada' },
  { valor: 'conquistas_desbloqueadas', label: 'Conquistas diferentes já desbloqueadas' },
  { valor: 'cadastro', label: 'Automática no cadastro (1º dia de app)' },
  { valor: 'conta_idade_dias', label: 'Dias desde a criação da conta' },
  { valor: 'pedido_e_oracoes:10', label: 'Fez pedido próprio de oração + orou por 10 pessoas' },
  { valor: 'top1_dias_seguidos', label: 'Dias seguidos em 1º no ranking' },
  // ---- adicionados na Atualização de Conquistas (múltiplos contadores) ----
  { valor: 'top3_dias_seguidos', label: 'Dias seguidos no Top 3 do ranking' },
  { valor: 'top10_dias_seguidos', label: 'Dias seguidos no Top 10 do ranking' },
  { valor: 'pontos_total', label: 'Pontos de Comunhão total (histórico, não zera na temporada)' },
  { valor: 'missoes_concluidas_total', label: 'Missões concluídas (qualquer uma)' },
  { valor: 'curtidas_recebidas_total', label: 'Curtidas recebidas (soma de todos os posts)' },
  { valor: 'comentarios_recebidos_total', label: 'Comentários recebidos (soma de todos os posts)' },
  { valor: 'mencoes_feitas_total', label: 'Menções feitas (@alguém em um comentário)' },
  { valor: 'mencoes_recebidas_total', label: 'Menções recebidas (@você em um comentário)' },
  { valor: 'pedido_oracao_criado_total', label: 'Pedidos/Agradecimentos de oração criados' },
  { valor: 'pessoas_diferentes_orou_total', label: 'Pessoas diferentes por quem já orou' },
  { valor: 'dracma_enviado_total', label: 'Dracma enviada (valor total, não quantidade)' },
  { valor: 'dracma_recebido_total', label: 'Dracma recebida (valor total, não quantidade)' },
  { valor: 'manual', label: 'Manual — sem contador automático, eu concedo à mão' },
];

function montarContadorTipo(tipoBase, missaoId, categoriaId) {
  if (tipoBase === 'missao') return `missao:${missaoId || ''}`;
  if (tipoBase === 'categoria') return `categoria:${categoriaId || ''}`;
  return tipoBase;
}

function desmontarContadorTipo(contadorTipo) {
  if ((contadorTipo || '').startsWith('missao:')) {
    return { tipoBase: 'missao', missaoId: contadorTipo.slice('missao:'.length), categoriaId: '' };
  }
  if ((contadorTipo || '').startsWith('categoria:')) {
    return { tipoBase: 'categoria', missaoId: '', categoriaId: contadorTipo.slice('categoria:'.length) };
  }
  return { tipoBase: contadorTipo || 'streak', missaoId: '', categoriaId: '' };
}

function descreverContador(conquista, missoesPorId, categoriasPorId) {
  // ATUALIZAÇÃO CONQUISTAS — precisa vir ANTES do desmontarContadorTipo:
  // conquista com `contadores` não necessariamente tem contadorTipo
  // preenchido, e sem esse desvio caía no fallback 'streak' (errado/
  // enganoso).
  if (Array.isArray(conquista.contadores) && conquista.contadores.length > 0) {
    const prazo = conquista.periodoValidacaoDias > 0 ? `prazo ${conquista.periodoValidacaoDias}d` : 'sem prazo';
    const vezes = conquista.meta > 1 ? ` · repete ${conquista.meta}x` : '';
    return `combo de ${conquista.contadores.length} contadores · ${prazo}${vezes}`;
  }
  const { tipoBase, missaoId, categoriaId } = desmontarContadorTipo(conquista.contadorTipo);
  if (tipoBase === 'manual') return 'concedida manualmente';
  if (tipoBase === 'missao') {
    const titulo = missoesPorId[missaoId]?.titulo || missaoId || 'missão apagada';
    return `${conquista.meta}x · ${titulo}`;
  }
  if (tipoBase === 'categoria') {
    const nome = categoriasPorId[categoriaId]?.nome || categoriaId || 'categoria apagada';
    return `${conquista.meta}x · categoria "${nome}"`;
  }
  const opcao = TIPOS_CONTADOR.find((t) => t.valor === tipoBase);
  return `${conquista.meta} · ${opcao?.label || tipoBase}`;
}

export default function AbaConquistas() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const [conquistas, setConquistas] = useState(null);
  const [missoes, setMissoes] = useState([]);
  const [categoriasAcao, setCategoriasAcao] = useState([]);
  const [conquistaEditando, setConquistaEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [apagando, setApagando] = useState(null);
  const [mostrarBuscaPessoa, setMostrarBuscaPessoa] = useState(false);
  const [mostrarAprovarManual, setMostrarAprovarManual] = useState(false);
  const [migrandoNovas, setMigrandoNovas] = useState(false);
  const [resultadoMigracaoNovas, setResultadoMigracaoNovas] = useState(null);

  const carregar = useCallback(() => {
    getTodasAsConquistas().then(setConquistas);
    getTodasAsMissoes().then(setMissoes);
    getTodasAsCategoriasAcao().then(setCategoriasAcao);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const missoesPorId = Object.fromEntries(missoes.map((m) => [m.id, m]));
  const categoriasPorId = Object.fromEntries(categoriasAcao.map((c) => [c.id, c]));

  async function handleMigrarNovas() {
    if (migrandoNovas) return;
    setMigrandoNovas(true);
    setResultadoMigracaoNovas(null);
    try {
      const criadas = await migrarConquistasNovasParaFirestore();
      setResultadoMigracaoNovas(
        criadas > 0
          ? `${criadas} conquista(s) nova(s) criada(s) com sucesso.`
          : 'Nada pra criar — as 25 conquistas novas já estavam aqui.'
      );
      carregar();
    } catch (err) {
      console.error('Erro na migração das conquistas novas:', err);
      setResultadoMigracaoNovas('Não foi possível criar agora. Tente de novo em instantes.');
    } finally {
      setMigrandoNovas(false);
    }
  }

  async function handleApagar(conquista) {
    const ok = await confirmar({
      titulo: `Apagar a conquista "${conquista.nome}"?`,
      descricao: 'Quem já desbloqueou continua com ela — só sai do catálogo pra quem ainda não tinha.',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;
    setApagando(conquista.id);
    try {
      await apagarConquista(conquista.id, perfil, conquista.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar conquista:', err);
    } finally {
      setApagando(null);
    }
  }

  const { itensVisuais: conquistasArrastaveis, propsDoItem, propsDaAlca } = useArrastarReordenar(
    conquistas || [],
    (novaOrdem) => reordenarConquistas(novaOrdem).then(carregar)
  );

  async function handleMover(index, direcao) {
    const alvo = index + direcao;
    if (!conquistasArrastaveis || alvo < 0 || alvo >= conquistasArrastaveis.length) return;
    try {
      await trocarOrdem(conquistasArrastaveis[index], conquistasArrastaveis[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar conquista:', err);
    }
  }

  if (!conquistas) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4">
        <p className="text-xs text-coffee-500">
          Clique aqui pra criar de uma vez as 25 conquistas novas (com os níveis I/II/III de cada
          uma — 65 no total). Depois de criadas, edite ou apague à vontade aqui embaixo, igual
          qualquer outra conquista. Seguro clicar mais de uma vez — só cria o que ainda não
          existir.
        </p>
        <button
          onClick={handleMigrarNovas}
          disabled={migrandoNovas}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {migrandoNovas ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Criar as 25 conquistas novas
        </button>
        {resultadoMigracaoNovas && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoMigracaoNovas}</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Conquistas</h3>
          <button
            onClick={() => setConquistaEditando('nova')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Nova
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Aparecem em círculo na aba de conquistas do perfil, de 5 em 5 por linha.
        </p>

        {conquistas.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhuma conquista cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {conquistasArrastaveis.map((conquista, index) => {
            return (
              <div
                key={conquista.id}
                {...propsDoItem(index)}
                className={`flex items-center gap-1.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                  conquista.ativa === false ? 'opacity-50' : ''
                }`}
              >
                <span
                  {...propsDaAlca(index)}
                  className="flex-shrink-0 cursor-grab touch-none text-coffee-200 active:cursor-grabbing"
                  aria-label="Arrastar para reordenar"
                >
                  <GripVertical size={15} />
                </span>
                <div className="flex flex-shrink-0 flex-col">
                  <button
                    onClick={() => handleMover(index, -1)}
                    disabled={index === 0}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button
                    onClick={() => handleMover(index, 1)}
                    disabled={index === conquistasArrastaveis.length - 1}
                    className="text-coffee-300 disabled:opacity-20"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>

                <EmblemaConquista conquista={conquista} size={40} bloqueada={false} mostrarCadeado={false} className="flex-shrink-0" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-coffee-800">
                    {conquista.nome}
                    {conquista.ativa === false && (
                      <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativa)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-coffee-400">
                    {descreverContador(conquista, missoesPorId, categoriasPorId)}
                  </p>
                </div>

                <button
                  onClick={() => setConquistaEditando(conquista)}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => handleApagar(conquista)}
                  disabled={apagando === conquista.id}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
                >
                  {apagando === conquista.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setMostrarBuscaPessoa((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-coffee-600"
        >
          <Users size={13} />
          {mostrarBuscaPessoa ? 'Esconder busca por pessoa' : 'Buscar quem já conquistou o quê'}
        </button>
        {mostrarBuscaPessoa && <BuscaConquistasPorPessoa />}

        <button
          onClick={() => setMostrarAprovarManual((v) => !v)}
          className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold text-coffee-600"
        >
          <UserCheck size={13} />
          {mostrarAprovarManual ? 'Esconder aprovar manualmente' : 'Aprovar conquista manualmente'}
        </button>
        {mostrarAprovarManual && <AprovarConquistaManual conquistas={conquistas} />}
      </div>

      {conquistaEditando && (
        <ConquistaFormModal
          conquistaInicial={conquistaEditando === 'nova' ? null : conquistaEditando}
          missoes={missoes}
          categoriasAcao={categoriasAcao}
          onFechar={() => setConquistaEditando(null)}
          onSalvo={() => {
            setConquistaEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Busca "por pessoa" das Conquistas — escolhe alguém e vê quais conquistas
// ela já desbloqueou e quando. Mesmo padrão de busca usado em Histórico/
// Missões/Ações (ver BuscaUsuario.js).
// ----------------------------------------------------------------------------
function BuscaConquistasPorPessoa() {
  const [usuarios, setUsuarios] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [conquistasDaPessoa, setConquistasDaPessoa] = useState(null);

  useEffect(() => {
    getAllUsers()
      .then(setUsuarios)
      .catch((err) => {
        console.error('[BuscaConquistasPorPessoa] Erro ao carregar usuários:', err);
        setUsuarios([]);
      });
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    setConquistasDaPessoa(null);
    getConquistasDoUsuario(selecionado.id)
      .then((todas) => setConquistasDaPessoa(todas.filter((c) => c.desbloqueada)))
      .catch((err) => {
        console.error('[BuscaConquistasPorPessoa] Erro ao buscar conquistas:', err);
        setConquistasDaPessoa([]);
      });
  }, [selecionado]);

  return (
    <div className="mt-2.5 space-y-2.5 rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <BuscaUsuario usuarios={usuarios} selecionado={selecionado} onSelecionar={setSelecionado} />

      {selecionado && conquistasDaPessoa === null && (
        <div className="h-12 animate-pulse rounded-lg bg-coffee-100/60" />
      )}
      {selecionado && conquistasDaPessoa?.length === 0 && (
        <p className="text-xs text-coffee-300">Essa pessoa ainda não desbloqueou nenhuma conquista.</p>
      )}
      {selecionado &&
        conquistasDaPessoa?.map((c) => {
          return (
            <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-cream px-3 py-2">
              <EmblemaConquista conquista={c} size={32} bloqueada={false} mostrarCadeado={false} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-coffee-700">{c.nome}</p>
                {c.desbloqueadoEm && (
                  <p className="text-[11px] text-coffee-300">
                    desbloqueada em {formatDateTimeBR(c.desbloqueadoEm)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}

// ----------------------------------------------------------------------------
// ATUALIZAÇÃO CONQUISTAS — Conquistas → Aprovar Manualmente. Só lista
// conquistas configuradas como manuais (contadorTipo === 'manual', ativas);
// escolhe a pessoa (mesmo BuscaUsuario de sempre) e concede com 1 toque.
// Passa pelo MESMO desbloquear() de uma conquista automática — recompensa
// de Pontos/Dracma, notificação, histórico e contagem pro ranking ficam
// idênticos (ver concederConquistaManualmente em lib/achievements.js).
// ----------------------------------------------------------------------------
function AprovarConquistaManual({ conquistas }) {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [concedendo, setConcedendo] = useState(null);
  const [resultado, setResultado] = useState({});

  const conquistasManuais = conquistas.filter((c) => c.contadorTipo === 'manual' && c.ativa !== false);

  useEffect(() => {
    getAllUsers()
      .then(setUsuarios)
      .catch((err) => {
        console.error('[AprovarConquistaManual] Erro ao carregar usuários:', err);
        setUsuarios([]);
      });
  }, []);

  async function handleConceder(conquista) {
    if (!selecionado || concedendo) return;
    setConcedendo(conquista.id);
    setResultado((r) => ({ ...r, [conquista.id]: null }));
    try {
      const concedida = await concederConquistaManualmente(selecionado.id, conquista.id, perfil);
      setResultado((r) => ({
        ...r,
        [conquista.id]: concedida ? 'Concedida!' : `${selecionado.nome} já tinha essa conquista.`,
      }));
    } catch (err) {
      console.error('Erro ao conceder conquista manual:', err);
      setResultado((r) => ({ ...r, [conquista.id]: 'Não foi possível conceder agora.' }));
    } finally {
      setConcedendo(null);
    }
  }

  return (
    <div className="mt-2.5 space-y-2.5 rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <BuscaUsuario usuarios={usuarios} selecionado={selecionado} onSelecionar={setSelecionado} />

      {conquistasManuais.length === 0 && (
        <p className="text-xs text-coffee-300">
          Nenhuma conquista manual ativa ainda — crie uma escolhendo &quot;Manual&quot; em
          &quot;O que conta pra essa conquista&quot;.
        </p>
      )}

      {selecionado &&
        conquistasManuais.map((c) => (
          <div key={c.id} className="flex items-center gap-2.5 rounded-lg bg-cream px-3 py-2">
            <EmblemaConquista conquista={c} size={32} bloqueada={false} mostrarCadeado={false} className="flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-coffee-700">{c.nome}</p>
              {resultado[c.id] && <p className="text-[11px] text-coffee-400">{resultado[c.id]}</p>}
            </div>
            <button
              onClick={() => handleConceder(c)}
              disabled={concedendo === c.id}
              className="flex-shrink-0 rounded-lg bg-coffee-700 px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-40"
            >
              {concedendo === c.id ? <Loader2 size={13} className="animate-spin" /> : 'Conceder'}
            </button>
          </div>
        ))}
    </div>
  );
}

// ATUALIZAÇÃO CONQUISTAS — os 3 modos de cada contador dentro de um combo de
// múltiplos contadores (ver comentário grande em avaliarConquistaMultiContador,
// lib/achievements.js, sobre o que cada um significa e a limitação de
// alguns contadores não terem histórico pra respeitar o modo escolhido).
const MODOS_CONTADOR = [
  { valor: 'estado_atual', label: 'Estado Atual (histórico todo, mesmo de antes da conquista)' },
  { valor: 'obtido_periodo', label: 'Obtido Durante o Período (só o progresso feito dentro do prazo)' },
  { valor: 'lancamento', label: 'A Partir do Lançamento (só desde que a conquista foi criada)' },
];

// Uma linha do editor de "múltiplos contadores" — mesma ideia de
// tipoBase/missaoId/categoriaId do formulário clássico acima, só que
// repetida por linha (cada contador do combo pode ser um tipo diferente).
function LinhaContadorMultiplo({ linha, onMudar, onRemover, missoes, categoriasAcao }) {
  const tiposSemManual = TIPOS_CONTADOR.filter((t) => t.valor !== 'manual');
  return (
    <div className="space-y-2 rounded-lg border border-coffee-100 bg-cream p-3">
      <div className="flex items-center gap-2">
        <select
          value={linha.tipoBase}
          onChange={(e) => onMudar({ ...linha, tipoBase: e.target.value })}
          className="w-full rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-2 text-xs text-coffee-800"
        >
          {tiposSemManual.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={onRemover} className="flex-shrink-0 text-coffee-400">
          <X size={16} />
        </button>
      </div>

      {linha.tipoBase === 'missao' && (
        <select
          value={linha.missaoId}
          onChange={(e) => onMudar({ ...linha, missaoId: e.target.value })}
          className="w-full rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-2 text-xs text-coffee-800"
        >
          <option value="">Qual missão…</option>
          {missoes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.titulo}
            </option>
          ))}
        </select>
      )}

      {linha.tipoBase === 'categoria' && (
        <select
          value={linha.categoriaId}
          onChange={(e) => onMudar({ ...linha, categoriaId: e.target.value })}
          className="w-full rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-2 text-xs text-coffee-800"
        >
          <option value="">Qual categoria…</option>
          {categoriasAcao.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          min="1"
          value={linha.meta}
          onChange={(e) => onMudar({ ...linha, meta: e.target.value })}
          placeholder="Meta"
          className="w-20 flex-shrink-0 rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-2 text-xs text-coffee-800"
        />
        <select
          value={linha.modo}
          onChange={(e) => onMudar({ ...linha, modo: e.target.value })}
          className="w-full rounded-lg border border-coffee-100 bg-cream-card px-2.5 py-2 text-xs text-coffee-800"
        >
          {MODOS_CONTADOR.map((m) => (
            <option key={m.valor} value={m.valor}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</label>
      {children}
    </div>
  );
}

function ConquistaFormModal({ conquistaInicial, missoes, categoriasAcao, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!conquistaInicial;
  const iniciais = desmontarContadorTipo(conquistaInicial?.contadorTipo);

  const [nome, setNome] = useState(conquistaInicial?.nome || '');
  const [descricao, setDescricao] = useState(conquistaInicial?.descricao || '');
  const [icone, setIcone] = useState(conquistaInicial?.icone || 'award');
  const [emblema, setEmblema] = useState(conquistaInicial?.emblema || '');
  const [tipoBase, setTipoBase] = useState(iniciais.tipoBase);
  const [missaoId, setMissaoId] = useState(iniciais.missaoId);
  const [categoriaId, setCategoriaId] = useState(iniciais.categoriaId);
  const [meta, setMeta] = useState(conquistaInicial?.meta ?? 10);
  const [ativa, setAtiva] = useState(conquistaInicial?.ativa ?? true);

  // ATUALIZAÇÃO CONQUISTAS — múltiplos contadores + período de validação.
  // `usarMultiplo` liga/desliga o modo avançado; desligado, o formulário se
  // comporta 100% como antes (1 contadorTipo + meta). `contadoresLinhas`
  // espelha tipoBase/missaoId/categoriaId do formulário clássico, só que
  // uma vez por linha — convertido pra { tipo, meta, modo } só na hora de
  // salvar (ver montarContadorTipo/handleSalvar).
  const usarMultiploInicial = Array.isArray(conquistaInicial?.contadores) && conquistaInicial.contadores.length > 0;
  const [usarMultiplo, setUsarMultiplo] = useState(usarMultiploInicial);
  const [contadoresLinhas, setContadoresLinhas] = useState(() => {
    if (!usarMultiploInicial) {
      return [{ tipoBase: 'streak', missaoId: '', categoriaId: '', meta: 1, modo: 'estado_atual' }];
    }
    return conquistaInicial.contadores.map((c) => {
      const d = desmontarContadorTipo(c.tipo);
      return { tipoBase: d.tipoBase, missaoId: d.missaoId, categoriaId: d.categoriaId, meta: c.meta ?? 1, modo: c.modo || 'estado_atual' };
    });
  });
  const [periodoValidacaoDias, setPeriodoValidacaoDias] = useState(conquistaInicial?.periodoValidacaoDias || '');
  const [pontosRecompensa, setPontosRecompensa] = useState(conquistaInicial?.pontosRecompensa || '');
  const [dracmaRecompensa, setDracmaRecompensa] = useState(conquistaInicial?.dracmaRecompensa || '');

  function adicionarLinhaContador() {
    setContadoresLinhas((linhas) => [
      ...linhas,
      { tipoBase: 'streak', missaoId: '', categoriaId: '', meta: 1, modo: 'estado_atual' },
    ]);
  }
  function mudarLinhaContador(index, novaLinha) {
    setContadoresLinhas((linhas) => linhas.map((l, i) => (i === index ? novaLinha : l)));
  }
  function removerLinhaContador(index) {
    setContadoresLinhas((linhas) => linhas.filter((_, i) => i !== index));
  }

  const [previewImagem, setPreviewImagem] = useState(conquistaInicial?.imagemURL || '');
  const [arquivoImagem, setArquivoImagem] = useState(null);
  const [srcCorte, setSrcCorte] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    return () => {
      if (srcCorte) URL.revokeObjectURL(srcCorte);
    };
  }, [srcCorte]);
  useEffect(() => {
    return () => {
      if (arquivoImagem && previewImagem) URL.revokeObjectURL(previewImagem);
    };
  }, [arquivoImagem, previewImagem]);

  function handleEscolherImagem(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setSrcCorte(URL.createObjectURL(arquivo));
    e.target.value = '';
  }

  function handleCortado(blob) {
    setSrcCorte('');
    const file = new File([blob], 'conquista.jpg', { type: 'image/jpeg' });
    setArquivoImagem(file);
    setPreviewImagem(URL.createObjectURL(blob));
  }

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    if (usarMultiplo && contadoresLinhas.length === 0) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        descricao: descricao.trim(),
        icone,
        emblema,
        ativa,
        // ATUALIZAÇÃO CONQUISTAS — recompensa opcional, vale pra clássica,
        // múltipla E manual (todas passam pelo mesmo desbloquear()).
        pontosRecompensa: Number(pontosRecompensa) || 0,
        dracmaRecompensa: Number(dracmaRecompensa) || 0,
      };

      if (usarMultiplo) {
        dados.contadores = contadoresLinhas.map((l) => ({
          tipo: montarContadorTipo(l.tipoBase, l.missaoId, l.categoriaId),
          meta: Number(l.meta) || 1,
          modo: l.modo,
        }));
        dados.periodoValidacaoDias = Number(periodoValidacaoDias) || 0;
        dados.meta = Number(meta) || 1; // aqui vira "quantas vezes repetir o combo"
        dados.contadorTipo = null; // combo múltiplo não usa o contadorTipo clássico
      } else {
        dados.contadores = []; // permite "desligar" o modo múltiplo numa edição
        dados.periodoValidacaoDias = 0;
        dados.contadorTipo = montarContadorTipo(tipoBase, missaoId, categoriaId);
        dados.meta = tipoBase === 'manual' ? null : Number(meta) || 0;
      }

      let idFinal;
      if (editando) {
        idFinal = conquistaInicial.id;
        await atualizarConquista(idFinal, dados, perfil);
      } else {
        idFinal = await criarConquista(dados, null, perfil);
      }

      if (arquivoImagem) {
        const imagemURL = await uploadImagemConquista(idFinal, arquivoImagem);
        await atualizarConquista(idFinal, { imagemURL }, perfil);
      }

      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar conquista:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 1, h: 1 }}
        onConfirmar={handleCortado}
        onCancelar={() => setSrcCorte('')}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-coffee-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar conquista' : 'Nova conquista'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Imagem circular (opcional — sem imagem, usa o ícone abaixo)">
            <div className="flex items-center gap-3">
              <EmblemaConquista
                conquista={{ imagemURL: previewImagem, icone, emblema }}
                size={56}
                bloqueada={false}
                mostrarCadeado={false}
                className="flex-shrink-0"
              />
              <label className="cursor-pointer rounded-lg border border-coffee-200 px-3 py-2 text-xs font-semibold text-coffee-700">
                {previewImagem ? 'Trocar imagem' : 'Enviar imagem'}
                <input type="file" accept="image/*" onChange={handleEscolherImagem} className="hidden" />
              </label>
              {previewImagem && (
                <button
                  type="button"
                  onClick={() => {
                    setPreviewImagem('');
                    setArquivoImagem(null);
                  }}
                  className="text-xs text-coffee-400 underline"
                >
                  Remover
                </button>
              )}
            </div>
          </Campo>

          <Campo label="Ícone de reserva (usado enquanto não há imagem)">
            <IconGalleryPicker value={icone} onChange={(valor) => setIcone(valor || 'award')} />
          </Campo>

          <Campo label="Emblema (moldura do tier — opcional)">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEmblema('')}
                className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold ${
                  emblema === ''
                    ? 'border-coffee-600 text-coffee-600'
                    : 'border-dashed border-coffee-200 text-coffee-300'
                }`}
              >
                Nenhum
              </button>
              {EMBLEMAS.map((tier) => (
                <button
                  key={tier.id}
                  type="button"
                  onClick={() => setEmblema(tier.id)}
                  title={tier.nome}
                  className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full ${
                    emblema === tier.id ? 'ring-2 ring-coffee-600 ring-offset-2 ring-offset-cream' : ''
                  }`}
                >
                  <img src={caminhoEmblema(tier.id)} alt={tier.nome} className="h-full w-full" />
                </button>
              ))}
            </div>
          </Campo>

          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Terminei a Carreira"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Texto (aparece quando a pessoa toca na conquista)">
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
              placeholder="Ex: Completou 1 ano de app."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Múltiplos contadores + período de validação (opcional)">
            <label className="flex items-center justify-between gap-2 rounded-lg border border-coffee-100 bg-cream px-3 py-2.5">
              <span className="text-[11px] text-coffee-500">
                Combine várias condições (ex.: 3 missões diferentes) com um prazo em dias pra
                cumprir todas juntas, em vez de um contador só.
              </span>
              <input
                type="checkbox"
                checked={usarMultiplo}
                onChange={(e) => setUsarMultiplo(e.target.checked)}
                className="flex-shrink-0"
              />
            </label>
          </Campo>

          {!usarMultiplo && (
            <Campo label="O que conta pra essa conquista">
              <select
                value={tipoBase}
                onChange={(e) => setTipoBase(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                {TIPOS_CONTADOR.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {!usarMultiplo && tipoBase === 'missao' && (
            <Campo label="Qual missão">
              <select
                value={missaoId}
                onChange={(e) => setMissaoId(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                <option value="">Selecione…</option>
                {missoes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.titulo}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          {!usarMultiplo && tipoBase === 'categoria' && (
            <Campo label="Qual categoria de ação">
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                <option value="">Selecione…</option>
                {categoriasAcao.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
              {categoriasAcao.length === 0 && (
                <p className="mt-1.5 text-[11px] text-coffee-400">
                  Nenhuma categoria criada ainda — vá em Admin &gt; Ações &gt; Ações específicas primeiro.
                </p>
              )}
            </Campo>
          )}

          {!usarMultiplo && tipoBase !== 'manual' && (
            <Campo label="Quantas vezes é preciso fazer (meta)">
              <input
                type="number"
                min="1"
                value={meta}
                onChange={(e) => setMeta(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          )}

          {!usarMultiplo && tipoBase === 'manual' && (
            <p className="text-xs text-coffee-400">
              Conquista manual não é desbloqueada sozinha — precisa ser concedida à mão em
              Conquistas &gt; Aprovar Manualmente (fora deste formulário).
            </p>
          )}

          {usarMultiplo && (
            <>
              <Campo label="Contadores do combo (todos precisam ser cumpridos)">
                <div className="space-y-2">
                  {contadoresLinhas.map((linha, index) => (
                    <LinhaContadorMultiplo
                      key={index}
                      linha={linha}
                      onMudar={(nova) => mudarLinhaContador(index, nova)}
                      onRemover={() => removerLinhaContador(index)}
                      missoes={missoes}
                      categoriasAcao={categoriasAcao}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={adicionarLinhaContador}
                  className="mt-2 flex items-center gap-1 text-xs font-semibold text-coffee-600"
                >
                  <Plus size={13} /> Adicionar contador
                </button>
              </Campo>

              <Campo label="Período de validação em dias (prazo pessoal pra cumprir todos — vazio = sem prazo)">
                <input
                  type="number"
                  min="1"
                  value={periodoValidacaoDias}
                  onChange={(e) => setPeriodoValidacaoDias(e.target.value)}
                  placeholder="Ex: 1, 7, 30…"
                  className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>

              <Campo label="Quantas vezes repetir o combo (deixe 1 pra valer só uma vez)">
                <input
                  type="number"
                  min="1"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Recompensa em Pontos (opcional)">
              <input
                type="number"
                min="0"
                value={pontosRecompensa}
                onChange={(e) => setPontosRecompensa(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
            <Campo label="Recompensa em Dracma (opcional)">
              <input
                type="number"
                min="0"
                value={dracmaRecompensa}
                onChange={(e) => setDracmaRecompensa(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          </div>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (entra no catálogo e passa a valer pra quem usa o app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar conquista'}
          </button>
        </div>
      </div>
    </div>
  );
}
