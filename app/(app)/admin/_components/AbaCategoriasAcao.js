'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import {
  getTodasAsCategoriasAcao,
  criarCategoriaAcao,
  atualizarCategoriaAcao,
  apagarCategoriaAcao,
  trocarOrdemCategoriaAcao,
} from '@/lib/categoriasAcaoRepo';
import { useAuth } from '@/components/AuthProvider';

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
  if (categoria.temLimite) {
    const periodo = OPCOES_PERIODO.find((p) => p.valor === categoria.limitePeriodo)?.label || categoria.limitePeriodo;
    partes.push(`limite ${categoria.limiteQtd || 1}x ${periodo}`);
  }
  return partes.join(' · ');
}

export default function AbaCategoriasAcao() {
  const { perfil } = useAuth();
  const [categorias, setCategorias] = useState(null);
  const [categoriaEditando, setCategoriaEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [apagando, setApagando] = useState(null);

  const carregar = useCallback(() => {
    getTodasAsCategoriasAcao().then(setCategorias);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleApagar(categoria) {
    if (
      !confirm(
        `Apagar a categoria "${categoria.nome}"? Posts já publicados com ela mantêm a pontuação/Dracma já recebidos — só sai do seletor pra novos posts.`
      )
    )
      return;
    setApagando(categoria.id);
    try {
      await apagarCategoriaAcao(categoria.id, perfil, categoria.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar categoria:', err);
    } finally {
      setApagando(null);
    }
  }

  async function handleMover(index, direcao) {
    const alvo = index + direcao;
    if (!categorias || alvo < 0 || alvo >= categorias.length) return;
    try {
      await trocarOrdemCategoriaAcao(categorias[index], categorias[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar categoria:', err);
    }
  }

  if (!categorias) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Categorias de ação</h3>
          <button
            onClick={() => setCategoriaEditando('nova')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Nova
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Hoje usadas como categoria de post no Feed (o usuário escolhe ao publicar). Toda ação
          registrada por uma categoria entra num log central — permite contar qualquer categoria
          automaticamente, inclusive pra criar conquistas na aba Conquistas.
        </p>

        {categorias.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhuma categoria cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {categorias.map((categoria, index) => (
            <div
              key={categoria.id}
              className={`flex items-center gap-2 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                categoria.ativa === false ? 'opacity-50' : ''
              }`}
            >
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
                  disabled={index === categorias.length - 1}
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
                onClick={() => handleApagar(categoria)}
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
      </div>

      {categoriaEditando && (
        <CategoriaFormModal
          categoriaInicial={categoriaEditando === 'nova' ? null : categoriaEditando}
          onFechar={() => setCategoriaEditando(null)}
          onSalvo={() => {
            setCategoriaEditando(null);
            carregar();
          }}
        />
      )}
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
  const [temLimite, setTemLimite] = useState(categoriaInicial?.temLimite ?? false);
  const [limiteQtd, setLimiteQtd] = useState(categoriaInicial?.limiteQtd ?? 1);
  const [limitePeriodo, setLimitePeriodo] = useState(categoriaInicial?.limitePeriodo || 'dia');

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
        temLimite,
        limiteQtd: temLimite ? Math.max(1, Number(limiteQtd) || 1) : 1,
        limitePeriodo: temLimite ? limitePeriodo : 'sempre',
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
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar categoria' : 'Nova categoria'}
          </h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <Campo label="Nome (aparece no seletor de categoria ao postar)">
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
            <Campo label="Quantos pontos por post">
              <input
                type="number"
                min="0"
                value={pontos}
                onChange={(e) => setPontos(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={daDracma} onChange={(e) => setDaDracma(e.target.checked)} />
            Dá Dracma
          </label>
          {daDracma && (
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
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={temLimite} onChange={(e) => setTemLimite(e.target.checked)} />
            Tem limite de quantas vezes pontua/dá Dracma
          </label>
          {temLimite && (
            <div className="flex gap-3">
              <div className="flex-1">
                <Campo label="Quantas vezes">
                  <input
                    type="number"
                    min="1"
                    value={limiteQtd}
                    onChange={(e) => setLimiteQtd(e.target.value)}
                    className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                  />
                </Campo>
              </div>
              <div className="flex-1">
                <Campo label="Período">
                  <select
                    value={limitePeriodo}
                    onChange={(e) => setLimitePeriodo(e.target.value)}
                    className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
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
          {temLimite && (
            <p className="text-[11px] text-coffee-400">
              Depois do limite, a pessoa ainda consegue postar nessa categoria normalmente — só
              deixa de pontuar/dar Dracma até o próximo período.
            </p>
          )}

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (aparece no seletor de categoria pra quem usa o app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar categoria'}
          </button>
        </div>
      </div>
    </div>
  );
}
