'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, Plus, Pencil, Trash2, ChevronUp, ChevronDown, GripVertical, X } from 'lucide-react';
import {
  getTodasAsFuncoes,
  subscribeATodasAsFuncoes,
  criarFuncao,
  atualizarFuncao,
  apagarFuncao,
  trocarOrdemFuncao,
  reordenarFuncoes,
} from '@/lib/funcoesRepo';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { useArrastarReordenar } from './useArrastarReordenar';

export default function AbaFuncoes() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const [funcoes, setFuncoes] = useState(null);
  const [funcaoEditando, setFuncaoEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [apagando, setApagando] = useState(null);

  const carregar = useCallback(() => {
    getTodasAsFuncoes().then(setFuncoes);
  }, []);

  // Escuta ao vivo (onSnapshot) em vez de buscar uma vez só — a lista de
  // Funções reflete mudanças na hora, sem sair-e-voltar. `carregar` acima
  // continua existindo e sendo chamada em alguns pontos abaixo — com a
  // escuta já ativa isso virou redundante, mas inofensivo.
  useEffect(() => {
    const unsub = subscribeATodasAsFuncoes(setFuncoes);
    return unsub;
  }, []);

  async function handleApagar(funcao) {
    const ok = await confirmar({
      titulo: `Apagar a função "${funcao.nome}"?`,
      descricao:
        'Quem já estava com essa função continua com ela salva — só sai da lista de opções pra escolha nova.',
      perigo: true,
      labelConfirmar: 'Apagar',
    });
    if (!ok) return;

    setApagando(funcao.id);
    try {
      await apagarFuncao(funcao.id, perfil, funcao.nome);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar função:', err);
    } finally {
      setApagando(null);
    }
  }

  async function handleMover(index, direcao) {
    const alvo = index + direcao;
    if (!itensVisuais || alvo < 0 || alvo >= itensVisuais.length) return;
    try {
      await trocarOrdemFuncao(itensVisuais[index], itensVisuais[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar função:', err);
    }
  }

  // Item novo — arrastar-e-soltar pra reordenar, mesmo padrão já usado em
  // Ações/Conquistas/Missões/Materiais (ver useArrastarReordenar.js). As
  // setinhas de handleMover acima continuam funcionando à parte, pra quem
  // preferir tocar em vez de arrastar.
  const { itensVisuais, propsDoItem, propsDaAlca } = useArrastarReordenar(
    funcoes || [],
    (novaOrdem) => reordenarFuncoes(novaOrdem).then(carregar)
  );

  if (!funcoes) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="font-destaque text-sm font-semibold text-coffee-700">Funções</h3>
          <button
            onClick={() => setFuncaoEditando('nova')}
            className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
          >
            <Plus size={13} /> Nova
          </button>
        </div>
        <p className="mb-2 text-[11px] text-coffee-300">
          Toda pessoa tem uma função, escolhida entre as ATIVAS. Inativas somem da lista, mas
          quem já tinha continua com ela.
        </p>

        {itensVisuais.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhuma função cadastrada ainda.</p>
        )}

        <div className="space-y-2">
          {itensVisuais.map((funcao, index) => (
            <div
              key={funcao.id}
              {...propsDoItem(index)}
              className={`flex items-center gap-1.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                funcao.ativa === false ? 'opacity-50' : ''
              }`}
            >
              <span
                {...propsDaAlca(index)}
                className="-m-1.5 flex-shrink-0 cursor-grab touch-none p-1.5 text-coffee-200 active:cursor-grabbing"
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
                  disabled={index === itensVisuais.length - 1}
                  className="text-coffee-300 disabled:opacity-20"
                >
                  <ChevronDown size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-coffee-800">
                  {funcao.nome}
                  {funcao.ativa === false && (
                    <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativa)</span>
                  )}
                </p>
              </div>

              <button
                onClick={() => setFuncaoEditando(funcao)}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
              >
                <Pencil size={13} />
              </button>
              <button
                onClick={() => handleApagar(funcao)}
                disabled={apagando === funcao.id}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
              >
                {apagando === funcao.id ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {funcaoEditando && (
        <FuncaoFormModal
          funcaoInicial={funcaoEditando === 'nova' ? null : funcaoEditando}
          onFechar={() => setFuncaoEditando(null)}
          onSalvo={() => {
            setFuncaoEditando(null);
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

function FuncaoFormModal({ funcaoInicial, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!funcaoInicial;

  const [nome, setNome] = useState(funcaoInicial?.nome || '');
  const [ativa, setAtiva] = useState(funcaoInicial?.ativa ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function handleSalvar() {
    if (!nome.trim() || salvando) return;
    setSalvando(true);
    setErro('');
    try {
      const dados = { nome: nome.trim(), ativa };
      if (editando) {
        await atualizarFuncao(funcaoInicial.id, dados, perfil);
      } else {
        await criarFuncao(dados, perfil);
      }
      onSalvo();
    } catch (err) {
      console.error('Erro ao salvar função:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">
            {editando ? 'Editar função' : 'Nova função'}
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
              placeholder="Ex: Líder de Mídia"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (aparece como opção pra quem usa o app)
          </label>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!nome.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar função'}
          </button>
        </div>
      </div>
    </div>
  );
}
