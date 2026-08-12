'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Check,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  GripVertical,
  X,
  Search,
  Users,
  Clock,
} from 'lucide-react';
import { getConfigsAcoesBasicas, subscribeAConfigsAcoesBasicas, salvarConfigAcaoBasica } from '@/lib/missionOverrides';
import {
  getTodasAsCategoriasAcao,
  subscribeATodasAsCategoriasAcao,
  criarCategoriaAcao,
  atualizarCategoriaAcao,
  apagarCategoriaAcao,
  trocarOrdemCategoriaAcao,
  reordenarCategoriasAcao,
} from '@/lib/categoriasAcaoRepo';
import { buscarAcoesPorUsuarioAgrupado } from '@/lib/acoesLog';
import { getAllUsers } from '@/lib/firestore-helpers';
import { combinaComBusca } from '@/lib/searchUtils';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import BuscaUsuario from './BuscaUsuario';
import { useArrastarReordenar } from './useArrastarReordenar';

const ACOES_BASICAS = [
  { id: 'postarNoFeed', titulo: 'Post no Feed' },
  { id: 'orarPorAlguem', titulo: 'Orar por alguém' },
  { id: 'abrirVersiculo', titulo: 'Abrir o Verso do Dia' },
];

const OPCOES_PERIODO = [
  { valor: 'dia', label: 'por dia' },
  { valor: 'semana', label: 'por semana' },
  { valor: 'mes', label: 'por mês' },
  { valor: 'sempre', label: 'no total (vitalício)' },
];

function descreverCategoria(categoria) {
  const partes = [];
  if (categoria.pontua) partes.push(`${categoria.pontos || 0} ponto(s)`);
  if (categoria.daDracma) partes.push(`${categoria.dracma || 0} Dracma`);
  if (partes.length === 0) partes.push('não pontua nem dá Dracma');

  if (categoria.pontosTemLimite) {
    const periodo =
      OPCOES_PERIODO.find((p) => p.valor === categoria.pontosLimitePeriodo)?.label ||
      categoria.pontosLimitePeriodo;
    partes.push(`pontos até ${categoria.pontosLimiteQtd || 1}x ${periodo}`);
  }
  if (categoria.dracmaTemLimite) {
    const periodo =
      OPCOES_PERIODO.find((p) => p.valor === categoria.dracmaLimitePeriodo)?.label ||
      categoria.dracmaLimitePeriodo;
    partes.push(`Dracma até ${categoria.dracmaLimiteQtd || 1}x ${periodo}`);
  }

  const obrigatorios = [];
  if (categoria.exigeImagem) obrigatorios.push('imagem');
  if (categoria.exigeTexto) obrigatorios.push('texto');
  if (categoria.exigeAudio) obrigatorios.push('áudio');
  if (obrigatorios.length > 0) partes.push(`exige ${obrigatorios.join(' + ')}`);
  if (categoria.horarioAtivo && categoria.horarioInicio && categoria.horarioFim) {
    partes.push(`visível ${categoria.horarioInicio}–${categoria.horarioFim}`);
  }

  return partes.join(' · ');
}

export default function AbaAcoes() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();

  // --- Ações básicas -----------------------------------------------------
  const [configsBasicas, setConfigsBasicas] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [salvoId, setSalvoId] = useState(null);

  // --- Ações específicas (antiga aba "Categorias") ------------------------
  const [categorias, setCategorias] = useState(null);
  const [categoriaEditando, setCategoriaEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [apagando, setApagando] = useState(null);
  const [buscaCategoria, setBuscaCategoria] = useState('');
  const [mostrarBuscaPessoa, setMostrarBuscaPessoa] = useState(false);

  const carregarConfigsBasicas = useCallback(() => {
    getConfigsAcoesBasicas().then(setConfigsBasicas);
  }, []);

  const carregarCategorias = useCallback(() => {
    getTodasAsCategoriasAcao().then(setCategorias);
  }, []);

  // Escuta ao vivo (onSnapshot) em vez de buscar uma vez só — tanto as
  // configs de Ações Básicas quanto as Categorias/Ações específicas
  // refletem mudanças na hora, sem sair-e-voltar nem recarregar. As
  // funções carregar* acima continuam existindo e sendo chamadas em
  // alguns pontos abaixo — com a escuta já ativa isso virou redundante,
  // mas inofensivo.
  useEffect(() => {
    const unsubConfigs = subscribeAConfigsAcoesBasicas(setConfigsBasicas);
    const unsubCategorias = subscribeATodasAsCategoriasAcao(setCategorias);
    return () => {
      unsubConfigs();
      unsubCategorias();
    };
  }, []);

  async function handleSalvarAcaoBasica(id, novaConfig) {
    setSalvandoId(id);
    try {
      const salvo = await salvarConfigAcaoBasica(id, novaConfig, perfil);
      setConfigsBasicas((atual) => ({ ...atual, [id]: salvo }));
      setSalvoId(id);
      setTimeout(() => setSalvoId(null), 1500);
    } catch (err) {
      console.error('Erro ao salvar ação básica:', err);
    } finally {
      setSalvandoId(null);
    }
  }

  async function handleApagarCategoria(categoria) {
    const ok = await confirmar({
      titulo: `Apagar a categoria "${categoria.nome}"?`,
      descricao:
        'Posts já publicados com ela mantêm a pontuação/Dracma já recebidos — só sai do seletor pra novos posts.',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;

    setApagando(categoria.id);
    try {
      await apagarCategoriaAcao(categoria.id, perfil, categoria.nome);
      carregarCategorias();
    } catch (err) {
      console.error('Erro ao apagar categoria:', err);
    } finally {
      setApagando(null);
    }
  }

  const categoriasFiltradas = useMemo(() => {
    if (!categorias) return null;
    if (!buscaCategoria.trim()) return categorias;
    return categorias.filter((c) => combinaComBusca(c.nome, buscaCategoria));
  }, [categorias, buscaCategoria]);

  async function handleMoverCategoria(index, direcao) {
    // CORREÇÃO DE BUG: usava categoriasFiltradas (lista "crua", só some com
    // a ordem nova depois que o carregarCategorias() abaixo terminar de
    // buscar do banco) em vez de categoriasArrastaveis (lista já
    // sincronizada com o último arraste, é a que aparece na tela — ver
    // useArrastarReordenar mais abaixo). Numa janela curta logo depois de
    // arrastar um item, isso podia mover a categoria errada. Mesmo padrão
    // já usado certo em AbaMissoes.js e AbaConquistas.js.
    const alvo = index + direcao;
    if (!categoriasArrastaveis || alvo < 0 || alvo >= categoriasArrastaveis.length) return;
    try {
      await trocarOrdemCategoriaAcao(categoriasArrastaveis[index], categoriasArrastaveis[alvo]);
      carregarCategorias();
    } catch (err) {
      console.error('Erro ao reordenar categoria:', err);
    }
  }

  const {
    itensVisuais: categoriasArrastaveis,
    propsDoItem,
    propsDaAlca,
  } = useArrastarReordenar(categoriasFiltradas || [], (novaOrdem) =>
    reordenarCategoriasAcao(novaOrdem).then(carregarCategorias)
  );

  if (!configsBasicas || !categorias) {
    return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;
  }

  return (
    <div className="space-y-8">
      {/* ================= AÇÕES BÁSICAS ================= */}
      <div>
        <h3 className="mb-1 font-destaque text-sm font-semibold text-coffee-700">Ações básicas</h3>
        <p className="mb-2 text-[11px] text-coffee-300">
          Pontos de missão se editam na aba Missões. Aqui é só o que é fixo do app — cada ação
          pode dar Pontos de Comunhão, Dracma, os dois, ou nenhum dos dois.
        </p>
        <div className="space-y-2.5">
          {ACOES_BASICAS.map((m) => (
            <LinhaAcaoBasica
              key={m.id}
              acao={m}
              configAtual={configsBasicas[m.id]}
              onSalvar={handleSalvarAcaoBasica}
              salvando={salvandoId === m.id}
              salvo={salvoId === m.id}
            />
          ))}
        </div>
      </div>

      {/* ================= AÇÕES ESPECÍFICAS ================= */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Ações específicas</h3>
          <button
            onClick={() => setCategoriaEditando('nova')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Nova
          </button>
        </div>
        <p className="mb-3 text-[11px] text-coffee-300">
          Categorias usadas ao publicar no Feed. Sem data de fim, com limite configurável de
          quantas vezes pontuam ou dão Dracma.
        </p>

        <div className="relative mb-2.5">
          <Search
            size={15}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
          />
          <input
            type="text"
            value={buscaCategoria}
            onChange={(e) => setBuscaCategoria(e.target.value)}
            placeholder="Buscar categoria por nome..."
            className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
          />
        </div>

        {categoriasFiltradas.length === 0 && (
          <p className="text-xs text-coffee-300">
            {buscaCategoria.trim()
              ? 'Nenhuma categoria encontrada com esse nome.'
              : 'Nenhuma categoria cadastrada ainda.'}
          </p>
        )}

        <div className="space-y-2">
          {categoriasArrastaveis.map((categoria, index) => (
            <div
              key={categoria.id}
              {...propsDoItem(index)}
              className={`flex items-center gap-1.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                categoria.ativa === false ? 'opacity-50' : ''
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
                  onClick={() => handleMoverCategoria(index, -1)}
                  disabled={index === 0}
                  className="text-coffee-300 disabled:opacity-20"
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  onClick={() => handleMoverCategoria(index, 1)}
                  disabled={index === categoriasArrastaveis.length - 1}
                  className="text-coffee-300 disabled:opacity-20"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-coffee-800">
                  {categoria.nome}
                  {categoria.ativa === false && (
                    <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativa)</span>
                  )}
                </p>
                <p className="truncate text-xs text-coffee-400">{descreverCategoria(categoria)}</p>
              </div>

              <button
                onClick={() => setCategoriaEditando(categoria)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleApagarCategoria(categoria)}
                disabled={apagando === categoria.id}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
              >
                {apagando === categoria.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </div>
          ))}
        </div>

        <button
          onClick={() => setMostrarBuscaPessoa((v) => !v)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-coffee-600"
        >
          <Users size={13} />
          {mostrarBuscaPessoa ? 'Esconder busca por pessoa' : 'Buscar o que uma pessoa já fez'}
        </button>
        {mostrarBuscaPessoa && <BuscaAcoesPorPessoa categorias={categorias} />}
      </div>

      {categoriaEditando && (
        <CategoriaFormModal
          categoriaInicial={categoriaEditando === 'nova' ? null : categoriaEditando}
          onFechar={() => setCategoriaEditando(null)}
          onSalvo={() => {
            setCategoriaEditando(null);
            carregarCategorias();
          }}
        />
      )}
    </div>
  );
}

function LinhaAcaoBasica({ acao, configAtual, onSalvar, salvando, salvo }) {
  const [pontua, setPontua] = useState(configAtual?.pontua ?? true);
  const [pontos, setPontos] = useState(configAtual?.pontos ?? 0);
  const [daDracma, setDaDracma] = useState(configAtual?.daDracma ?? false);
  const [dracma, setDracma] = useState(configAtual?.dracma ?? 0);

  return (
    <div className="rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-3">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-sm font-medium text-coffee-700">{acao.titulo}</span>
        <button
          onClick={() => onSalvar(acao.id, { pontua, pontos, daDracma, dracma })}
          disabled={salvando}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-forte text-cream disabled:opacity-40"
        >
          {salvando ? (
            <Loader2 size={14} className="animate-spin" />
          ) : salvo ? (
            <Check size={14} />
          ) : (
            <Save size={14} />
          )}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5 text-xs text-coffee-500">
          <input type="checkbox" checked={pontua} onChange={(e) => setPontua(e.target.checked)} />
          Pontua
        </label>
        {pontua && (
          <input
            type="number"
            min={0}
            value={pontos}
            onChange={(e) => setPontos(e.target.value)}
            className="w-16 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-center text-sm text-coffee-800"
          />
        )}

        <label className="flex items-center gap-1.5 text-xs text-coffee-500">
          <input type="checkbox" checked={daDracma} onChange={(e) => setDaDracma(e.target.checked)} />
          Dá Dracma
        </label>
        {daDracma && (
          <input
            type="number"
            min={0}
            step="0.01"
            value={dracma}
            onChange={(e) => setDracma(e.target.value)}
            className="w-16 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-center text-sm text-coffee-800"
          />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Busca "por pessoa" das Ações específicas — escolhe alguém e vê quantas
// vezes ela já usou cada categoria, e quando foi a última vez. Mesmo padrão
// de busca usado em Histórico/Conquistas/Missões (ver BuscaUsuario.js).
// ----------------------------------------------------------------------------
function BuscaAcoesPorPessoa({ categorias }) {
  const [usuarios, setUsuarios] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    getAllUsers()
      .then(setUsuarios)
      .catch((err) => {
        console.error('[BuscaAcoesPorPessoa] Erro ao carregar usuários:', err);
        setUsuarios([]);
      });
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    setRegistros(null);
    buscarAcoesPorUsuarioAgrupado(selecionado.id)
      .then(setRegistros)
      .catch((err) => {
        console.error('[BuscaAcoesPorPessoa] Erro ao buscar ações:', err);
        setRegistros([]);
      });
  }, [selecionado]);

  const categoriasPorId = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c])),
    [categorias]
  );

  return (
    <div className="mt-2.5 space-y-2.5 rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <BuscaUsuario usuarios={usuarios} selecionado={selecionado} onSelecionar={setSelecionado} />

      {selecionado && registros === null && (
        <div className="h-12 animate-pulse rounded-lg bg-coffee-100/60" />
      )}
      {selecionado && registros?.length === 0 && (
        <p className="text-xs text-coffee-300">Essa pessoa ainda não usou nenhuma categoria.</p>
      )}
      {selecionado &&
        registros?.map((r) => (
          <div
            key={r.categoriaId}
            className="flex items-center justify-between gap-2 rounded-lg bg-cream px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-coffee-700">
                {categoriasPorId[r.categoriaId]?.nome || r.categoriaNome}
              </p>
              {r.ultimaData && (
                <p className="text-[11px] text-coffee-300">
                  última vez em {formatDateTimeBR(r.ultimaData)}
                </p>
              )}
            </div>
            <span className="flex-shrink-0 font-destaque text-sm font-bold text-coffee-700">
              {r.quantidade}x
            </span>
          </div>
        ))}
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

function CategoriaFormModal({ categoriaInicial, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!categoriaInicial;

  const [nome, setNome] = useState(categoriaInicial?.nome || '');
  const [ativa, setAtiva] = useState(categoriaInicial?.ativa ?? true);
  const [pontua, setPontua] = useState(categoriaInicial?.pontua ?? true);
  const [pontos, setPontos] = useState(categoriaInicial?.pontos ?? 5);
  const [daDracma, setDaDracma] = useState(categoriaInicial?.daDracma ?? false);
  const [dracma, setDracma] = useState(categoriaInicial?.dracma ?? 0);

  // Limite de PONTOS — independente do limite de Dracma abaixo.
  const [pontosTemLimite, setPontosTemLimite] = useState(categoriaInicial?.pontosTemLimite ?? false);
  const [pontosLimiteQtd, setPontosLimiteQtd] = useState(categoriaInicial?.pontosLimiteQtd ?? 1);
  const [pontosLimitePeriodo, setPontosLimitePeriodo] = useState(
    categoriaInicial?.pontosLimitePeriodo || 'dia'
  );

  // Limite de DRACMA — independente do limite de pontos acima.
  const [dracmaTemLimite, setDracmaTemLimite] = useState(categoriaInicial?.dracmaTemLimite ?? false);
  const [dracmaLimiteQtd, setDracmaLimiteQtd] = useState(categoriaInicial?.dracmaLimiteQtd ?? 1);
  const [dracmaLimitePeriodo, setDracmaLimitePeriodo] = useState(
    categoriaInicial?.dracmaLimitePeriodo || 'dia'
  );

  // O que é obrigatório no post pra usar essa categoria.
  const [exigeImagem, setExigeImagem] = useState(categoriaInicial?.exigeImagem ?? false);
  const [exigeTexto, setExigeTexto] = useState(categoriaInicial?.exigeTexto ?? false);
  const [exigeAudio, setExigeAudio] = useState(categoriaInicial?.exigeAudio ?? false);

  // Horário de visibilidade: sem marcar, a categoria fica disponível o dia
  // inteiro no seletor de categoria (comportamento de sempre). Marcando, só
  // aparece pro usuário entre horarioInicio e horarioFim.
  const [horarioAtivo, setHorarioAtivo] = useState(categoriaInicial?.horarioAtivo ?? false);
  const [horarioInicio, setHorarioInicio] = useState(categoriaInicial?.horarioInicio || '08:00');
  const [horarioFim, setHorarioFim] = useState(categoriaInicial?.horarioFim || '18:00');

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = {
        nome: nome.trim(),
        ativa,
        pontua,
        pontos: pontua ? Number(pontos) || 0 : 0,
        daDracma,
        dracma: daDracma ? Number(dracma) || 0 : 0,
        pontosTemLimite: pontua ? pontosTemLimite : false,
        pontosLimiteQtd: pontua && pontosTemLimite ? Math.max(1, Number(pontosLimiteQtd) || 1) : 1,
        pontosLimitePeriodo: pontua && pontosTemLimite ? pontosLimitePeriodo : 'sempre',
        dracmaTemLimite: daDracma ? dracmaTemLimite : false,
        dracmaLimiteQtd: daDracma && dracmaTemLimite ? Math.max(1, Number(dracmaLimiteQtd) || 1) : 1,
        dracmaLimitePeriodo: daDracma && dracmaTemLimite ? dracmaLimitePeriodo : 'sempre',
        exigeImagem,
        exigeTexto,
        exigeAudio,
        horarioAtivo,
        horarioInicio: horarioAtivo ? horarioInicio : null,
        horarioFim: horarioAtivo ? horarioFim : null,
      };

      if (editando) {
        await atualizarCategoriaAcao(categoriaInicial.id, dados, perfil);
      } else {
        await criarCategoriaAcao(dados, perfil);
      }

      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar categoria:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Nome">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Testemunho"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={pontua} onChange={(e) => setPontua(e.target.checked)} />
            Pontua (dá Pontos de Comunhão)
          </label>
          {pontua && (
            <>
              <Campo label="Quantos pontos por post">
                <input
                  type="number"
                  min="0"
                  value={pontos}
                  onChange={(e) => setPontos(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>

              <div className="rounded-xl border border-coffee-100 bg-cream-card p-3">
                <label className="flex items-center gap-2 text-xs text-coffee-500">
                  <input
                    type="checkbox"
                    checked={pontosTemLimite}
                    onChange={(e) => setPontosTemLimite(e.target.checked)}
                  />
                  Tem limite de quantas vezes dá PONTOS
                </label>
                {pontosTemLimite && (
                  <div className="mt-2.5 flex gap-3">
                    <div className="flex-1">
                      <Campo label="Quantas vezes">
                        <input
                          type="number"
                          min="1"
                          value={pontosLimiteQtd}
                          onChange={(e) => setPontosLimiteQtd(e.target.value)}
                          className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                        />
                      </Campo>
                    </div>
                    <div className="flex-1">
                      <Campo label="Período">
                        <select
                          value={pontosLimitePeriodo}
                          onChange={(e) => setPontosLimitePeriodo(e.target.value)}
                          className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                        >
                          {OPCOES_PERIODO.map((p) => (
                            <option key={p.valor} value={p.valor}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={daDracma} onChange={(e) => setDaDracma(e.target.checked)} />
            Dá Dracma
          </label>
          {daDracma && (
            <>
              <Campo label="Quanto Dracma por post">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={dracma}
                  onChange={(e) => setDracma(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>

              <div className="rounded-xl border border-coffee-100 bg-cream-card p-3">
                <label className="flex items-center gap-2 text-xs text-coffee-500">
                  <input
                    type="checkbox"
                    checked={dracmaTemLimite}
                    onChange={(e) => setDracmaTemLimite(e.target.checked)}
                  />
                  Tem limite de quantas vezes dá DRACMA
                </label>
                {dracmaTemLimite && (
                  <div className="mt-2.5 flex gap-3">
                    <div className="flex-1">
                      <Campo label="Quantas vezes">
                        <input
                          type="number"
                          min="1"
                          value={dracmaLimiteQtd}
                          onChange={(e) => setDracmaLimiteQtd(e.target.value)}
                          className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                        />
                      </Campo>
                    </div>
                    <div className="flex-1">
                      <Campo label="Período">
                        <select
                          value={dracmaLimitePeriodo}
                          onChange={(e) => setDracmaLimitePeriodo(e.target.value)}
                          className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                        >
                          {OPCOES_PERIODO.map((p) => (
                            <option key={p.valor} value={p.valor}>
                              {p.label}
                            </option>
                          ))}
                        </select>
                      </Campo>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
          {((pontua && pontosTemLimite) || (daDracma && dracmaTemLimite)) && (
            <p className="text-[11px] text-coffee-400">
              Depois do limite, continua postando normalmente — só para de pontuar/dar Dracma até
              o próximo período.
            </p>
          )}

          <div className="rounded-xl border border-coffee-100 bg-cream-card p-3">
            <p className="mb-2 text-xs font-medium text-coffee-500">
              O que é obrigatório no post pra usar essa categoria
            </p>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={exigeImagem}
                  onChange={(e) => setExigeImagem(e.target.checked)}
                />
                Imagem obrigatória
              </label>
              <label className="flex items-center gap-2 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={exigeTexto}
                  onChange={(e) => setExigeTexto(e.target.checked)}
                />
                Texto obrigatório
              </label>
              <label className="flex items-center gap-2 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={exigeAudio}
                  onChange={(e) => setExigeAudio(e.target.checked)}
                />
                Áudio obrigatório
              </label>
            </div>
            <p className="mt-2 text-[11px] text-coffee-400">Nada marcado = sem exigência.</p>
          </div>

          <div className="rounded-xl border border-coffee-100 bg-cream-card p-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-coffee-600">
              <input
                type="checkbox"
                checked={horarioAtivo}
                onChange={(e) => setHorarioAtivo(e.target.checked)}
              />
              <Clock size={13} />
              Só ficar visível num horário específico
            </label>
            <p className="mt-1 text-[11px] text-coffee-300">Sem marcar, fica visível o dia todo.</p>
            {horarioAtivo && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Campo label="Das">
                  <input
                    type="time"
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                  />
                </Campo>
                <Campo label="Até">
                  <input
                    type="time"
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-800"
                  />
                </Campo>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (visível no app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}
