'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Check,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  getTodasAsMissoes,
  criarMissao,
  atualizarMissao,
  apagarMissao,
  trocarOrdem,
  migrarMissoesDoCodigoParaFirestore,
  migrarCamposDasMissoes,
  migrarPeriodicidadeParaCiclos,
} from '@/lib/missionsRepo';
import { statusDaMissao } from '@/lib/missionCycles';
import { getAllUsers } from '@/lib/firestore-helpers';
import { todayBrasilia } from '@/lib/dateUtils';
import { slugify } from '@/lib/slug';
import { useAuth } from '@/components/AuthProvider';
import Avatar from '@/components/Avatar';
import IconGalleryPicker from '@/components/IconGalleryPicker';

const CATEGORIAS = [
  { valor: 'exclusiva', label: 'Missões Exclusivas', legenda: 'Só quem for marcado em "Destinatários" vê' },
  { valor: 'geral', label: 'Missões Gerais', legenda: 'Aparece pra todo mundo (a menos que restrinja por destinatários)' },
];

const TIPO_CAMPO_OPCOES = [
  { valor: 'texto-curto', label: 'Texto curto' },
  { valor: 'texto-longo', label: 'Texto longo' },
  { valor: 'link', label: 'Link' },
  { valor: 'check', label: 'Confirmação (check)' },
];

const ROTULO_STATUS = {
  nao_iniciada: 'ainda não começou',
  encerrada: 'encerrada',
};

// Contador simples pra gerar ids estáveis pros campos de resposta do form
// (antes usava o índice do array como key — funcionava, mas ao remover um
// campo do meio da lista o React podia reciclar o DOM node errado entre
// renders; com id próprio por campo isso não depende mais da posição).
let proximoIdCampo = 1;

// A missão não tem mais um `tipo` fixo (isso foi removido na migração pro
// formato de campos livres — ver migrarCamposDasMissoes). Esse resumo troca
// aquele campo antigo por uma descrição baseada no que a missão realmente
// tem hoje: quantos campos, se permite foto/áudio, qual o período e quantas
// vezes dá pra cumprir dentro dele.
function descreverMissao(missao) {
  const partes = [];
  const qtdCampos = (missao.campos || []).length;
  if (qtdCampos > 0) partes.push(`${qtdCampos} campo${qtdCampos > 1 ? 's' : ''}`);
  if (missao.permiteFoto) partes.push('foto');
  if (missao.permiteAudio) partes.push('áudio');
  const resposta = partes.length > 0 ? partes.join(' · ') : 'sem campos de resposta';

  let periodo = 'período não definido';
  if (missao.duracaoDias) {
    const dias = `a cada ${missao.duracaoDias} dia${missao.duracaoDias > 1 ? 's' : ''}`;
    periodo = missao.repeteAutomaticamente ? dias : `${dias} (não repete)`;
  }
  const vezes = missao.vezesPorPeriodo > 1 ? ` · ${missao.vezesPorPeriodo}x por período` : '';

  return `${resposta} · ${periodo}${vezes}`;
}

export default function AbaMissoes() {
  const { perfil } = useAuth();
  const [missoes, setMissoes] = useState(null);
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracao, setResultadoMigracao] = useState(null);
  const [corrigindoCampos, setCorrigindoCampos] = useState(false);
  const [resultadoCorrecaoCampos, setResultadoCorrecaoCampos] = useState(null);
  const [corrigindoPeriodo, setCorrigindoPeriodo] = useState(false);
  const [resultadoCorrecaoPeriodo, setResultadoCorrecaoPeriodo] = useState(null);
  const [missaoEditando, setMissaoEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [categoriaNova, setCategoriaNova] = useState('geral');
  const [apagando, setApagando] = useState(null);

  const carregar = useCallback(() => {
    getTodasAsMissoes().then(setMissoes);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleMigrar() {
    if (migrando) return;
    setMigrando(true);
    setResultadoMigracao(null);
    try {
      const criadas = await migrarMissoesDoCodigoParaFirestore();
      setResultadoMigracao(
        criadas > 0
          ? `${criadas} missão(ões) migrada(s) com sucesso.`
          : 'Nada pra migrar — todas as missões do código já estavam aqui.'
      );
      carregar();
    } catch (err) {
      console.error('Erro na migração de missões:', err);
      setResultadoMigracao('Não foi possível migrar agora. Tente de novo em instantes.');
    } finally {
      setMigrando(false);
    }
  }

  async function handleCorrigirCampos() {
    if (corrigindoCampos) return;
    setCorrigindoCampos(true);
    setResultadoCorrecaoCampos(null);
    try {
      const migradas = await migrarCamposDasMissoes();
      setResultadoCorrecaoCampos(
        migradas > 0
          ? `${migradas} missão(ões) com o formato corrigido.`
          : 'Nada pra corrigir — todas as missões já estão no formato novo.'
      );
      carregar();
    } catch (err) {
      console.error('Erro ao corrigir formato dos campos das missões:', err);
      setResultadoCorrecaoCampos('Não foi possível corrigir agora. Tente de novo em instantes.');
    } finally {
      setCorrigindoCampos(false);
    }
  }

  async function handleCorrigirPeriodo() {
    if (corrigindoPeriodo) return;
    setCorrigindoPeriodo(true);
    setResultadoCorrecaoPeriodo(null);
    try {
      const migradas = await migrarPeriodicidadeParaCiclos();
      setResultadoCorrecaoPeriodo(
        migradas > 0
          ? `${migradas} missão(ões) convertida(s) pro novo período.`
          : 'Nada pra converter — todas as missões já estão no formato novo de período.'
      );
      carregar();
    } catch (err) {
      console.error('Erro ao converter período das missões:', err);
      setResultadoCorrecaoPeriodo('Não foi possível converter agora. Tente de novo em instantes.');
    } finally {
      setCorrigindoPeriodo(false);
    }
  }

  async function handleApagar(missao) {
    if (!confirm(`Apagar a missão "${missao.titulo}"? Isso não afeta o histórico já registrado.`))
      return;
    setApagando(missao.id);
    try {
      await apagarMissao(missao.id, perfil, missao.titulo);
      carregar();
    } catch (err) {
      console.error('Erro ao apagar missão:', err);
    } finally {
      setApagando(null);
    }
  }

  async function handleMover(lista, index, direcao) {
    const alvo = index + direcao;
    if (alvo < 0 || alvo >= lista.length) return;
    try {
      await trocarOrdem(lista[index], lista[alvo]);
      carregar();
    } catch (err) {
      console.error('Erro ao reordenar missão:', err);
    }
  }

  if (!missoes) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  const grupos = CATEGORIAS.map((c) => ({
    ...c,
    lista: missoes.filter((m) => (m.categoria || 'geral') === c.valor),
  }));

  return (
    <div className="space-y-6">
      <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4">
        <p className="text-xs text-coffee-500">
          Se você acabou de ativar isso, clique aqui uma vez pra trazer as missões que já
          existiam no código pra dentro desta lista. É seguro clicar mais de uma vez — só cria o
          que ainda não existir.
        </p>
        <button
          onClick={handleMigrar}
          disabled={migrando}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {migrando ? <Loader2 size={14} className="animate-spin" /> : <UploadCloud size={14} />}
          Migrar missões do código
        </button>
        {resultadoMigracao && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoMigracao}</p>
        )}

        <button
          onClick={handleCorrigirCampos}
          disabled={corrigindoCampos}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {corrigindoCampos ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
          Corrigir formato dos campos
        </button>
        {resultadoCorrecaoCampos && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoCorrecaoCampos}</p>
        )}

        <button
          onClick={handleCorrigirPeriodo}
          disabled={corrigindoPeriodo}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {corrigindoPeriodo ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
          Converter período (diária/semanal/mensal → dias)
        </button>
        {resultadoCorrecaoPeriodo && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoCorrecaoPeriodo}</p>
        )}
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.valor}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="font-destaque text-sm font-semibold text-coffee-700">{grupo.label}</h3>
            <button
              onClick={() => {
                setCategoriaNova(grupo.valor);
                setMissaoEditando('nova');
              }}
              className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
            >
              <Plus size={13} /> Nova
            </button>
          </div>
          <p className="mb-2 text-[11px] text-coffee-300">{grupo.legenda}</p>

          {grupo.lista.length === 0 && (
            <p className="text-xs text-coffee-300">Nenhuma missão aqui ainda.</p>
          )}

          <div className="space-y-2">
            {grupo.lista.map((missao, index) => {
              const status = statusDaMissao(missao);
              return (
                <div
                  key={missao.id}
                  className={`flex items-center gap-2 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 ${
                    missao.ativa === false ? 'opacity-50' : ''
                  }`}
                >
                  <div className="flex flex-shrink-0 flex-col">
                    <button
                      onClick={() => handleMover(grupo.lista, index, -1)}
                      disabled={index === 0}
                      className="text-coffee-300 disabled:opacity-20"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <button
                      onClick={() => handleMover(grupo.lista, index, 1)}
                      disabled={index === grupo.lista.length - 1}
                      className="text-coffee-300 disabled:opacity-20"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-coffee-800">
                      {missao.titulo}
                      {missao.ativa === false && (
                        <span className="ml-1.5 text-[10px] font-medium text-coffee-400">(inativa)</span>
                      )}
                      {missao.ativa !== false && ROTULO_STATUS[status] && (
                        <span className="ml-1.5 text-[10px] font-medium text-coffee-400">
                          ({ROTULO_STATUS[status]})
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-coffee-400">
                      {descreverMissao(missao)} · +{missao.pontos} pontos
                    </p>
                  </div>
                  <button
                    onClick={() => setMissaoEditando(missao)}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-coffee-600"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleApagar(missao)}
                    disabled={apagando === missao.id}
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-200 text-red-600 disabled:opacity-40"
                  >
                    {apagando === missao.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {missaoEditando && (
        <MissaoFormModal
          missaoInicial={missaoEditando === 'nova' ? null : missaoEditando}
          categoriaPadrao={categoriaNova}
          onFechar={() => setMissaoEditando(null)}
          onSalvo={() => {
            setMissaoEditando(null);
            carregar();
          }}
        />
      )}
    </div>
  );
}

function MissaoFormModal({ missaoInicial, categoriaPadrao, onFechar, onSalvo }) {
  const { perfil } = useAuth();
  const editando = !!missaoInicial;
  const [titulo, setTitulo] = useState(missaoInicial?.titulo || '');
  const [categoria, setCategoria] = useState(missaoInicial?.categoria || categoriaPadrao || 'geral');
  const [icone, setIcone] = useState(missaoInicial?.icone || '');
  const [pontos, setPontos] = useState(missaoInicial?.pontos ?? 10);
  const [postaNoFeed, setPostaNoFeed] = useState(missaoInicial?.postaNoFeed ?? false);
  const [ativa, setAtiva] = useState(missaoInicial?.ativa ?? true);
  const [instrucoes, setInstrucoes] = useState(missaoInicial?.instrucoes || '');
  const [linkDrive, setLinkDrive] = useState(missaoInicial?.linkDrive || '');
  const [exigeAprovacaoAdmin, setExigeAprovacaoAdmin] = useState(
    missaoInicial?.exigeAprovacaoAdmin ?? false
  );
  const [permiteFoto, setPermiteFoto] = useState(missaoInicial?.permiteFoto ?? false);
  const [fotoObrigatoria, setFotoObrigatoria] = useState(missaoInicial?.fotoObrigatoria ?? false);
  const [permiteAudio, setPermiteAudio] = useState(missaoInicial?.permiteAudio ?? false);
  const [audioObrigatoria, setAudioObrigatoria] = useState(missaoInicial?.audioObrigatoria ?? false);
  const [campos, setCampos] = useState(
    (missaoInicial?.campos || []).map((c) => ({ ...c, obrigatorio: c.obrigatorio ?? true, _id: proximoIdCampo++ }))
  );

  // Novo modelo de período: início + duração (dias) + repete ou não +
  // quantas vezes dá pra cumprir dentro de cada ciclo (ver lib/missionCycles.js).
  const [dataInicio, setDataInicio] = useState(missaoInicial?.dataInicio || todayBrasilia());
  const [duracaoDias, setDuracaoDias] = useState(missaoInicial?.duracaoDias ?? 1);
  const [repeteAutomaticamente, setRepeteAutomaticamente] = useState(
    missaoInicial?.repeteAutomaticamente ?? true
  );
  const [vezesPorPeriodo, setVezesPorPeriodo] = useState(missaoInicial?.vezesPorPeriodo ?? 1);

  const [destinatarios, setDestinatarios] = useState(missaoInicial?.destinatarios || null);
  const [usuarios, setUsuarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  const selecionados = destinatarios || [];
  const todosSelecionados = usuarios.length > 0 && selecionados.length === usuarios.length;

  function alternarTodos() {
    setDestinatarios(todosSelecionados ? [] : usuarios.map((u) => u.id));
  }

  function alternarUm(uid) {
    setDestinatarios((sel) => {
      const atual = sel || [];
      return atual.includes(uid) ? atual.filter((id) => id !== uid) : [...atual, uid];
    });
  }

  function adicionarCampo() {
    setCampos((c) => [...c, { _id: proximoIdCampo++, chave: '', label: '', tipo: 'texto-curto', obrigatorio: true }]);
  }

  // A "chave interna" não é mais digitada à mão pelo Admin — era ali que
  // ficava o bug de "não aparece nada pro usuário" (alguém preenchia só a
  // chave e esquecia o texto da pergunta, que é o único campo realmente
  // mostrado na tela de resposta). Agora ela é gerada sozinha a partir da
  // pergunta, e nunca fica vazia.
  function atualizarLabelDoCampo(id, novoLabel) {
    setCampos((c) => {
      const chavesDosOutros = c.filter((x) => x._id !== id).map((x) => x.chave);
      const base = slugify(novoLabel) || 'campo';
      let chave = base;
      let n = 2;
      while (chavesDosOutros.includes(chave)) {
        chave = `${base}_${n}`;
        n += 1;
      }
      return c.map((campo) => (campo._id === id ? { ...campo, label: novoLabel, chave } : campo));
    });
  }

  function atualizarCampo(id, dados) {
    setCampos((c) => c.map((campo) => (campo._id === id ? { ...campo, ...dados } : campo)));
  }
  function removerCampo(id) {
    setCampos((c) => c.filter((campo) => campo._id !== id));
  }

  async function handleSalvar() {
    if (!titulo.trim() || salvando) return;

    // Toda missão precisa de pelo menos uma forma de resposta configurada —
    // um campo (check/texto/link), foto ou áudio. Sem isso, a tela de
    // responder ficaria vazia.
    if (campos.length === 0 && !permiteFoto && !permiteAudio) {
      setErro('Adicione pelo menos um campo, ou permita foto/áudio, pra essa missão ter como ser respondida.');
      return;
    }
    if (!dataInicio) {
      setErro('Escolha a data de início da missão.');
      return;
    }

    setSalvando(true);
    setErro('');

    // A missão agora é uma composição livre de blocos (campos + foto/áudio),
    // não mais um `tipo` fixo — o mesmo formato de `dados` vale pra qualquer missão.
    const dados = {
      titulo: titulo.trim(),
      categoria,
      icone: icone.trim(),
      pontos: Number(pontos) || 0,
      postaNoFeed,
      ativa,
      campos: campos
        .filter((c) => c.label.trim())
        .map((c) => ({
          chave: c.chave || slugify(c.label),
          label: c.label.trim(),
          tipo: c.tipo,
          obrigatorio: !!c.obrigatorio,
        })),
      permiteFoto,
      fotoObrigatoria: permiteFoto ? fotoObrigatoria : false,
      permiteAudio,
      audioObrigatoria: permiteAudio ? audioObrigatoria : false,
      instrucoes: instrucoes.trim(),
      linkDrive: linkDrive.trim(),
      exigeAprovacaoAdmin,
      dataInicio,
      duracaoDias: Math.max(1, Number(duracaoDias) || 1),
      repeteAutomaticamente,
      // Sempre tem limite — mínimo 1, nunca "ilimitado" (decisão combinada:
      // toda missão precisa de um teto de quantas vezes cabe no período).
      vezesPorPeriodo: Math.max(1, Number(vezesPorPeriodo) || 1),
    };

    dados.destinatarios = destinatarios && destinatarios.length > 0 ? destinatarios : null;

    try {
      if (editando) {
        await atualizarMissao(missaoInicial.id, dados, perfil);
      } else {
        await criarMissao(dados, undefined, perfil);
      }
      onSalvo?.();
    } catch (err) {
      console.error('Erro ao salvar missão:', err);
      setErro('Não foi possível salvar agora. Verifique sua internet e tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">
            {editando ? 'Editar missão' : 'Nova missão'}
          </h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 px-5 py-5">
          {editando && (
            <p className="text-xs text-coffee-300">
              ID: <code>{missaoInicial.id}</code> (não muda depois de criada)
            </p>
          )}

          <Campo label="Título">
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-coffee-500">Categoria</span>
            <div className="flex gap-2">
              {CATEGORIAS.map((c) => (
                <button
                  key={c.valor}
                  type="button"
                  onClick={() => setCategoria(c.valor)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-semibold ${
                    categoria === c.valor
                      ? 'border-coffee-700 bg-coffee-700 text-cream'
                      : 'border-coffee-200 text-coffee-600'
                  }`}
                >
                  {c.valor === 'exclusiva' ? 'Exclusiva' : 'Geral'}
                </button>
              ))}
            </div>
          </div>

          <Campo label="Ícone">
            <IconGalleryPicker value={icone} onChange={setIcone} />
          </Campo>

          <Campo label="Pontos">
            <input
              type="number"
              min={0}
              value={pontos}
              onChange={(e) => setPontos(e.target.value)}
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <div className="rounded-xl border border-coffee-100 bg-cream-card p-3.5">
            <p className="mb-3 text-xs font-semibold text-coffee-600">Período</p>

            <div className="grid grid-cols-2 gap-3">
              <Campo label="Início">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
              <Campo label="Duração (dias)">
                <input
                  type="number"
                  min={1}
                  value={duracaoDias}
                  onChange={(e) => setDuracaoDias(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
            </div>

            <label className="mt-3 flex items-center gap-2 text-xs text-coffee-500">
              <input
                type="checkbox"
                checked={repeteAutomaticamente}
                onChange={(e) => setRepeteAutomaticamente(e.target.checked)}
              />
              Repete automaticamente (um novo ciclo começa no dia seguinte ao fim do último)
            </label>
            {!repeteAutomaticamente && (
              <p className="mt-1 text-[11px] text-coffee-300">
                Sem repetição: a missão fica disponível só nesse período e some sozinha da lista
                de quem usa o app quando ele terminar.
              </p>
            )}

            <div className="mt-3">
              <Campo label="Vezes que dá pra cumprir por período">
                <input
                  type="number"
                  min={1}
                  value={vezesPorPeriodo}
                  onChange={(e) => setVezesPorPeriodo(e.target.value)}
                  className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
              <p className="mt-1 text-[11px] text-coffee-300">
                Mínimo 1. Ex.: missão diária com 3 aqui permite responder até 3x no mesmo dia
                antes de travar até o próximo ciclo.
              </p>
            </div>
          </div>

          <Campo label="Instruções (opcional)">
            <textarea
              rows={2}
              value={instrucoes}
              onChange={(e) => setInstrucoes(e.target.value)}
              placeholder="Texto explicando a missão, mostrado antes dos campos de resposta."
              className="w-full resize-none rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Link de material de apoio (opcional)">
            <input
              value={linkDrive}
              onChange={(e) => setLinkDrive(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <div>
            <label className="flex items-center gap-2 text-xs text-coffee-500">
              <input
                type="checkbox"
                checked={permiteFoto}
                onChange={(e) => setPermiteFoto(e.target.checked)}
              />
              Permite foto
            </label>
            {permiteFoto && (
              <label className="mt-1.5 flex items-center gap-2 pl-6 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={fotoObrigatoria}
                  onChange={(e) => setFotoObrigatoria(e.target.checked)}
                />
                Foto obrigatória
              </label>
            )}
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs text-coffee-500">
              <input
                type="checkbox"
                checked={permiteAudio}
                onChange={(e) => setPermiteAudio(e.target.checked)}
              />
              Permite áudio
            </label>
            {permiteAudio && (
              <label className="mt-1.5 flex items-center gap-2 pl-6 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={audioObrigatoria}
                  onChange={(e) => setAudioObrigatoria(e.target.checked)}
                />
                Áudio obrigatório
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input
              type="checkbox"
              checked={exigeAprovacaoAdmin}
              onChange={(e) => setExigeAprovacaoAdmin(e.target.checked)}
            />
            Exige aprovação do admin antes de valer os pontos
          </label>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-medium text-coffee-500">Campos de resposta</span>
              <button
                onClick={adicionarCampo}
                className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
              >
                <Plus size={12} /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {campos.map((campo, index) => (
                <div key={campo._id} className="rounded-lg border border-coffee-100 bg-cream-card p-2.5">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-coffee-400">
                      Campo {index + 1}
                    </span>
                    <button onClick={() => removerCampo(campo._id)} className="text-red-500">
                      <X size={12} />
                    </button>
                  </div>
                  <input
                    value={campo.label}
                    onChange={(e) => atualizarLabelDoCampo(campo._id, e.target.value)}
                    placeholder="Texto da pergunta (o que o usuário vê)"
                    className="mb-1.5 w-full rounded border border-coffee-100 bg-cream px-2 py-1.5 text-xs text-coffee-800"
                  />
                  <div className="flex items-center gap-1.5">
                    <select
                      value={campo.tipo}
                      onChange={(e) => atualizarCampo(campo._id, { tipo: e.target.value })}
                      className="flex-1 rounded border border-coffee-100 bg-cream px-2 py-1.5 text-xs text-coffee-800"
                    >
                      {TIPO_CAMPO_OPCOES.map((op) => (
                        <option key={op.valor} value={op.valor}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                    <label className="flex flex-shrink-0 items-center gap-1 text-[11px] text-coffee-500">
                      <input
                        type="checkbox"
                        checked={!!campo.obrigatorio}
                        onChange={(e) => atualizarCampo(campo._id, { obrigatorio: e.target.checked })}
                      />
                      Obrigatório
                    </label>
                  </div>
                </div>
              ))}
              {campos.length === 0 && (
                <p className="text-xs text-coffee-300">Nenhum campo adicionado ainda.</p>
              )}
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input
              type="checkbox"
              checked={postaNoFeed}
              onChange={(e) => setPostaNoFeed(e.target.checked)}
            />
            Vira post automático no feed ao ser cumprida
          </label>

          <label className="flex items-center gap-2 text-xs text-coffee-500">
            <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} />
            Ativa (aparece pra quem usa o app)
          </label>

          <div>
            <span className="mb-1.5 block text-xs font-medium text-coffee-500">
              Destinatários (opcional)
            </span>
            <p className="mb-2 text-[11px] text-coffee-300">
              Nenhum marcado = todos veem a missão. Marcando alguém, só quem for marcado a verá.
            </p>
            <div className="rounded-xl border border-coffee-100 bg-cream-card">
              <button
                type="button"
                onClick={alternarTodos}
                className="flex w-full items-center gap-2.5 border-b border-coffee-100 px-3.5 py-2.5"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded border ${
                    todosSelecionados ? 'border-coffee-700 bg-coffee-700 text-cream' : 'border-coffee-300'
                  }`}
                >
                  {todosSelecionados && <Check size={13} />}
                </span>
                <span className="text-sm font-semibold text-coffee-700">
                  Selecionar todos ({usuarios.length})
                </span>
              </button>
              <div className="max-h-52 overflow-y-auto">
                {usuarios.map((u) => {
                  const marcado = selecionados.includes(u.id);
                  return (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => alternarUm(u.id)}
                      className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3.5 py-2 last:border-b-0"
                    >
                      <span
                        className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${
                          marcado ? 'border-coffee-700 bg-coffee-700 text-cream' : 'border-coffee-300'
                        }`}
                      >
                        {marcado && <Check size={13} />}
                      </span>
                      <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
                      <span className="truncate text-sm text-coffee-700">{u.nome}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {erro && <p className="text-center text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleSalvar}
            disabled={!titulo.trim() || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            {editando ? 'Salvar alterações' : 'Criar missão'}
          </button>
        </div>
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
