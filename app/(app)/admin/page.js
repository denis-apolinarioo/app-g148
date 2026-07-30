'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import Avatar from '@/components/Avatar';
import { getPontosEfetivos, salvarPontosDaMissao } from '@/lib/missionOverrides';
import {
  getTodasAsMissoes,
  criarMissao,
  atualizarMissao,
  apagarMissao,
  trocarOrdem,
  migrarMissoesDoCodigoParaFirestore,
} from '@/lib/missionsRepo';
import {
  getAllUsers,
  createChallenge,
  subscribeToPendingChallenges,
  sendMailMessage,
  sendMailToMultiple,
} from '@/lib/firestore-helpers';
import { uploadFotoCorreio } from '@/lib/storage';
import { aprovarDesafio, rejeitarDesafio } from '@/lib/points';
import {
  ShieldAlert,
  Check,
  X,
  Loader2,
  Save,
  Plus,
  Pencil,
  Trash2,
  ChevronUp,
  ChevronDown,
  UploadCloud,
} from 'lucide-react';

const ABAS = ['Ações', 'Missões', 'Usuários', 'Desafios', 'Correio'];

export default function AdminPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState('Ações');

  useEffect(() => {
    if (perfil && !perfil.isAdmin) {
      router.replace('/feed');
    }
  }, [perfil, router]);

  if (!perfil) return <LoadingScreen />;
  if (!perfil.isAdmin) {
    return (
      <div className="mx-auto max-w-md">
        <TopBar titulo="Painel Admin" voltarPara="/perfil" />
        <EmptyState icone={ShieldAlert} titulo="Área restrita a administradores" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Painel Admin" voltarPara="/perfil" />

      <div className="flex gap-1.5 overflow-x-auto border-b border-coffee-100 px-4 pb-0.5 pt-3">
        {ABAS.map((a) => (
          <button
            key={a}
            onClick={() => setAba(a)}
            className={`flex-shrink-0 rounded-t-lg border-b-2 px-3 pb-2.5 text-sm font-medium ${
              aba === a ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="px-4 py-4">
        {aba === 'Ações' && <AbaAcoes />}
        {aba === 'Missões' && <AbaMissoes />}
        {aba === 'Usuários' && <AbaUsuarios />}
        {aba === 'Desafios' && <AbaDesafios />}
        {aba === 'Correio' && <AbaCorreio />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AbaAcoes() {
  const [mapaPontos, setMapaPontos] = useState(null);
  const [salvandoId, setSalvandoId] = useState(null);
  const [salvoId, setSalvoId] = useState(null);

  const carregar = useCallback(() => {
    getPontosEfetivos().then(setMapaPontos);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function handleSalvar(missaoId, valor) {
    const numero = Number(valor);
    if (Number.isNaN(numero) || numero < 0) return;
    setSalvandoId(missaoId);
    try {
      await salvarPontosDaMissao(missaoId, numero);
      setMapaPontos((m) => ({ ...m, [missaoId]: numero }));
      setSalvoId(missaoId);
      setTimeout(() => setSalvoId(null), 1500);
    } catch (err) {
      console.error('Erro ao salvar pontos:', err);
    } finally {
      setSalvandoId(null);
    }
  }

  if (!mapaPontos) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-6">
      <p className="text-xs text-coffee-400">
        Os pontos de cada missão agora se editam direto na aba{' '}
        <span className="font-semibold text-coffee-600">Missões</span> (junto com o resto da
        missão). Aqui fica só o que não é missão.
      </p>
      <GrupoPontos
        titulo="Outras ações"
        missoes={[
          { id: 'postarNoFeed', titulo: 'Post no Feed' },
          { id: 'orarPorAlguem', titulo: 'Orar por alguém' },
        ]}
        mapa={mapaPontos}
        onSalvar={handleSalvar}
        salvandoId={salvandoId}
        salvoId={salvoId}
      />
    </div>
  );
}

function GrupoPontos({ titulo, missoes, mapa, onSalvar, salvandoId, salvoId }) {
  const [valores, setValores] = useState({});

  return (
    <div>
      <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">{titulo}</h3>
      <div className="space-y-2">
        {missoes.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-2.5 rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5"
          >
            <span className="flex-1 truncate text-sm text-coffee-700">{m.titulo}</span>
            <input
              type="number"
              min={0}
              defaultValue={mapa[m.id]}
              onChange={(e) => setValores((v) => ({ ...v, [m.id]: e.target.value }))}
              className="w-16 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-center text-sm text-coffee-800"
            />
            <button
              onClick={() => onSalvar(m.id, valores[m.id] ?? mapa[m.id])}
              disabled={salvandoId === m.id}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-coffee-700 text-cream disabled:opacity-40"
            >
              {salvandoId === m.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : salvoId === m.id ? (
                <Check size={14} />
              ) : (
                <Save size={14} />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Item novo — CRUD completo de missões (antes era array fixo em código).
// ---------------------------------------------------------------------------
const PERIODICIDADES = [
  { valor: 'diaria', label: 'Diária' },
  { valor: 'semanal', label: 'Semanal' },
  { valor: 'mensal', label: 'Mensal' },
];

function AbaMissoes() {
  const [missoes, setMissoes] = useState(null);
  const [migrando, setMigrando] = useState(false);
  const [resultadoMigracao, setResultadoMigracao] = useState(null);
  const [missaoEditando, setMissaoEditando] = useState(null); // objeto = editar, 'nova' = criar
  const [periodicidadeNova, setPeriodicidadeNova] = useState('diaria');
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

  async function handleApagar(missao) {
    if (!confirm(`Apagar a missão "${missao.titulo}"? Isso não afeta o histórico já registrado.`))
      return;
    setApagando(missao.id);
    try {
      await apagarMissao(missao.id);
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

  const grupos = PERIODICIDADES.map((p) => ({
    ...p,
    lista: missoes.filter((m) => m.periodicidade === p.valor),
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
      </div>

      {grupos.map((grupo) => (
        <div key={grupo.valor}>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-destaque text-sm font-semibold text-coffee-700">{grupo.label}</h3>
            <button
              onClick={() => {
                setPeriodicidadeNova(grupo.valor);
                setMissaoEditando('nova');
              }}
              className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
            >
              <Plus size={13} /> Nova
            </button>
          </div>

          {grupo.lista.length === 0 && (
            <p className="text-xs text-coffee-300">Nenhuma missão {grupo.label.toLowerCase()} ainda.</p>
          )}

          <div className="space-y-2">
            {grupo.lista.map((missao, index) => (
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
                  </p>
                  <p className="text-xs text-coffee-400">
                    {missao.tipo} · +{missao.pontos} pontos
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
            ))}
          </div>
        </div>
      ))}

      {missaoEditando && (
        <MissaoFormModal
          missaoInicial={missaoEditando === 'nova' ? null : missaoEditando}
          periodicidadePadrao={periodicidadeNova}
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

const TIPO_CAMPO_OPCOES = [
  { valor: 'texto-curto', label: 'Texto curto' },
  { valor: 'texto-longo', label: 'Texto longo' },
  { valor: 'link', label: 'Link' },
];

function MissaoFormModal({ missaoInicial, periodicidadePadrao, onFechar, onSalvo }) {
  const editando = !!missaoInicial;
  const [titulo, setTitulo] = useState(missaoInicial?.titulo || '');
  const [tipo, setTipo] = useState(missaoInicial?.tipo || 'check');
  const [periodicidade, setPeriodicidade] = useState(
    missaoInicial?.periodicidade || periodicidadePadrao || 'diaria'
  );
  const [icone, setIcone] = useState(missaoInicial?.icone || '');
  const [pontos, setPontos] = useState(missaoInicial?.pontos ?? 10);
  const [postaNoFeed, setPostaNoFeed] = useState(missaoInicial?.postaNoFeed ?? false);
  const [ativa, setAtiva] = useState(missaoInicial?.ativa ?? true);
  const [perguntaConfirmacao, setPerguntaConfirmacao] = useState(
    missaoInicial?.perguntaConfirmacao || ''
  );
  const [descricao, setDescricao] = useState(missaoInicial?.descricao || '');
  const [linkDrive, setLinkDrive] = useState(missaoInicial?.linkDrive || '');
  const [exigeAprovacaoAdmin, setExigeAprovacaoAdmin] = useState(
    missaoInicial?.exigeAprovacaoAdmin ?? false
  );
  const [permiteFoto, setPermiteFoto] = useState(missaoInicial?.permiteFoto ?? false);
  const [campos, setCampos] = useState(missaoInicial?.campos || []);
  const [limiteRepeticoes, setLimiteRepeticoes] = useState(missaoInicial?.limiteRepeticoes ?? '');
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
    setCampos((c) => [...c, { chave: '', label: '', tipo: 'texto-curto' }]);
  }
  function atualizarCampo(index, dados) {
    setCampos((c) => c.map((campo, i) => (i === index ? { ...campo, ...dados } : campo)));
  }
  function removerCampo(index) {
    setCampos((c) => c.filter((_, i) => i !== index));
  }

  async function handleSalvar() {
    if (!titulo.trim() || salvando) return;
    setSalvando(true);
    setErro('');

    // Só grava os campos que fazem sentido pro tipo escolhido — evita deixar
    // "lixo" de outro tipo salvo no documento se o admin trocar o tipo.
    const dados = {
      titulo: titulo.trim(),
      tipo,
      periodicidade,
      icone: icone.trim(),
      pontos: Number(pontos) || 0,
      postaNoFeed,
      ativa,
    };

    if (tipo === 'check') {
      dados.perguntaConfirmacao = perguntaConfirmacao.trim();
    } else if (tipo === 'leitura') {
      dados.descricao = descricao.trim();
      dados.linkDrive = linkDrive.trim();
      dados.exigeAprovacaoAdmin = exigeAprovacaoAdmin;
    } else if (tipo === 'texto' || tipo === 'reflexao') {
      dados.permiteFoto = permiteFoto;
      dados.campos = campos
        .filter((c) => c.chave.trim() && c.label.trim())
        .map((c) => ({ chave: c.chave.trim(), label: c.label.trim(), tipo: c.tipo }));
    }

    dados.limiteRepeticoes = limiteRepeticoes === '' ? null : Number(limiteRepeticoes);
    dados.destinatarios = destinatarios && destinatarios.length > 0 ? destinatarios : null;

    try {
      if (editando) {
        await atualizarMissao(missaoInicial.id, dados);
      } else {
        await criarMissao(dados);
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

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Tipo">
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                <option value="check">Check (confirmação simples)</option>
                <option value="texto">Texto (campo curto)</option>
                <option value="reflexao">Reflexão (pergunta + foto)</option>
                <option value="leitura">Leitura (livro/material)</option>
              </select>
            </Campo>
            <Campo label="Periodicidade">
              <select
                value={periodicidade}
                onChange={(e) => setPeriodicidade(e.target.value)}
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              >
                {PERIODICIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Campo>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Campo label="Ícone (lucide-react, ex: sunrise)">
              <input
                value={icone}
                onChange={(e) => setIcone(e.target.value)}
                placeholder="sunrise"
                className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
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
          </div>

          {tipo === 'check' && (
            <Campo label="Pergunta de confirmação">
              <textarea
                rows={2}
                value={perguntaConfirmacao}
                onChange={(e) => setPerguntaConfirmacao(e.target.value)}
                className="w-full resize-none rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
              />
            </Campo>
          )}

          {tipo === 'leitura' && (
            <>
              <Campo label="Descrição">
                <textarea
                  rows={2}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full resize-none rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
              <Campo label="Link do material (Drive, etc.)">
                <input
                  value={linkDrive}
                  onChange={(e) => setLinkDrive(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
                />
              </Campo>
              <label className="flex items-center gap-2 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={exigeAprovacaoAdmin}
                  onChange={(e) => setExigeAprovacaoAdmin(e.target.checked)}
                />
                Exige aprovação do Admin
              </label>
            </>
          )}

          {(tipo === 'texto' || tipo === 'reflexao') && (
            <>
              <label className="flex items-center gap-2 text-xs text-coffee-500">
                <input
                  type="checkbox"
                  checked={permiteFoto}
                  onChange={(e) => setPermiteFoto(e.target.checked)}
                />
                Permite anexar foto
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs font-medium text-coffee-500">Perguntas</span>
                  <button
                    onClick={adicionarCampo}
                    className="flex items-center gap-1 text-xs font-semibold text-coffee-600"
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {campos.map((campo, index) => (
                    <div key={index} className="rounded-lg border border-coffee-100 bg-cream-card p-2.5">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-[10px] font-medium text-coffee-400">
                          Pergunta {index + 1}
                        </span>
                        <button onClick={() => removerCampo(index)} className="text-red-500">
                          <X size={12} />
                        </button>
                      </div>
                      <input
                        value={campo.label}
                        onChange={(e) => atualizarCampo(index, { label: e.target.value })}
                        placeholder="Texto da pergunta"
                        className="mb-1.5 w-full rounded border border-coffee-100 bg-cream px-2 py-1.5 text-xs text-coffee-800"
                      />
                      <div className="flex gap-1.5">
                        <input
                          value={campo.chave}
                          onChange={(e) => atualizarCampo(index, { chave: e.target.value })}
                          placeholder="chave_interna"
                          className="flex-1 rounded border border-coffee-100 bg-cream px-2 py-1.5 text-xs text-coffee-800"
                        />
                        <select
                          value={campo.tipo}
                          onChange={(e) => atualizarCampo(index, { tipo: e.target.value })}
                          className="rounded border border-coffee-100 bg-cream px-2 py-1.5 text-xs text-coffee-800"
                        >
                          {TIPO_CAMPO_OPCOES.map((op) => (
                            <option key={op.valor} value={op.valor}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {campos.length === 0 && (
                    <p className="text-xs text-coffee-300">Nenhuma pergunta adicionada ainda.</p>
                  )}
                </div>
              </div>
            </>
          )}

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

          <Campo label="Limite de repetições (opcional)">
            <input
              type="number"
              min={1}
              value={limiteRepeticoes}
              onChange={(e) => setLimiteRepeticoes(e.target.value)}
              placeholder="Sem limite"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
            <p className="mt-1 text-[11px] text-coffee-300">
              Quantas vezes, no total, cada pessoa pode cumprir essa missão. Deixe vazio pra sem limite.
            </p>
          </Campo>

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

// ---------------------------------------------------------------------------
function AbaUsuarios() {
  const [usuarios, setUsuarios] = useState(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  if (!usuarios) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <div className="space-y-2">
      <p className="mb-2 text-xs text-coffee-400">{usuarios.length} pessoas na comunidade</p>
      {usuarios.map((u) => (
        <div
          key={u.id}
          className="flex items-center gap-3 rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
        >
          <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
            <p className="text-xs text-coffee-300">@{u.username}</p>
          </div>
          <span className="font-destaque text-sm font-bold text-coffee-600">{u.pontos || 0}</span>
          {u.isAdmin && (
            <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
              admin
            </span>
          )}
        </div>
      ))}
      <p className="pt-3 text-xs text-coffee-300">
        Pra tornar alguém admin, é preciso editar diretamente no Firestore (coleção{' '}
        <code>users</code>, campo <code>isAdmin</code> → <code>true</code>) — uma trava extra de
        segurança pra esse tipo de permissão sensível.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AbaDesafios() {
  const [pendentes, setPendentes] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [criando, setCriando] = useState(false);
  const [destinatarioId, setDestinatarioId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState(50);
  const [enviando, setEnviando] = useState(false);
  const { perfil } = useAuth();

  useEffect(() => {
    const unsub = subscribeToPendingChallenges(setPendentes);
    getAllUsers().then(setUsuarios);
    return () => unsub();
  }, []);

  async function handleCriar() {
    if (!destinatarioId || !titulo.trim() || enviando) return;
    setEnviando(true);
    try {
      await createChallenge({
        destinatarioId,
        criadoPor: perfil.uid,
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        pontos: Number(pontos) || 0,
      });
      setTitulo('');
      setDescricao('');
      setCriando(false);
    } catch (err) {
      console.error('Erro ao criar desafio:', err);
    } finally {
      setEnviando(false);
    }
  }

  async function handleAprovar(desafio) {
    try {
      await aprovarDesafio(desafio.id, desafio.destinatarioId, desafio.pontos);
    } catch (err) {
      console.error('Erro ao aprovar desafio:', err);
    }
  }

  async function handleRejeitar(desafio) {
    try {
      await rejeitarDesafio(desafio.id);
    } catch (err) {
      console.error('Erro ao rejeitar desafio:', err);
    }
  }

  return (
    <div className="space-y-5">
      <button
        onClick={() => setCriando((v) => !v)}
        className="w-full rounded-xl border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700"
      >
        {criando ? 'Cancelar' : '+ Novo desafio individual'}
      </button>

      {criando && (
        <div className="space-y-3 rounded-xl2 border border-coffee-100 bg-cream-card p-4">
          <select
            value={destinatarioId}
            onChange={(e) => setDestinatarioId(e.target.value)}
            className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          >
            <option value="">Escolha a pessoa...</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </select>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Título do desafio"
            className="w-full rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          />
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Descrição (opcional)"
            rows={2}
            className="w-full resize-none rounded-lg border border-coffee-100 bg-cream px-3 py-2.5 text-sm text-coffee-800"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-coffee-500">Pontos:</span>
            <input
              type="number"
              min={0}
              value={pontos}
              onChange={(e) => setPontos(e.target.value)}
              className="w-20 rounded-lg border border-coffee-100 bg-cream px-2 py-1.5 text-sm text-coffee-800"
            />
          </div>
          <button
            onClick={handleCriar}
            disabled={!destinatarioId || !titulo.trim() || enviando}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {enviando && <Loader2 size={14} className="animate-spin" />}
            Enviar desafio
          </button>
        </div>
      )}

      <div>
        <h3 className="mb-2 font-destaque text-sm font-semibold text-coffee-700">
          Aguardando aprovação
        </h3>
        {pendentes === null && <div className="h-16 animate-pulse rounded-xl bg-coffee-100/60" />}
        {pendentes?.length === 0 && (
          <p className="text-xs text-coffee-300">Nenhum desafio aguardando aprovação.</p>
        )}
        <div className="space-y-2">
          {pendentes?.map((d) => (
            <div key={d.id} className="rounded-xl border border-coffee-100 bg-cream-card p-3.5">
              <p className="text-sm font-semibold text-coffee-800">{d.titulo}</p>
              {d.descricao && <p className="mt-0.5 text-xs text-coffee-500">{d.descricao}</p>}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-coffee-400">+{d.pontos} pontos</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejeitar(d)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-red-700"
                  >
                    <X size={13} />
                  </button>
                  <button
                    onClick={() => handleAprovar(d)}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700"
                  >
                    <Check size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AbaCorreio() {
  const [usuarios, setUsuarios] = useState([]);
  const [selecionados, setSelecionados] = useState([]);
  const [texto, setTexto] = useState('');
  const [fixada, setFixada] = useState(false);
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const { perfil } = useAuth();
  const inputFotoRef = useRef(null);

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  const todosSelecionados = usuarios.length > 0 && selecionados.length === usuarios.length;

  function alternarTodos() {
    setSelecionados(todosSelecionados ? [] : usuarios.map((u) => u.id));
  }

  function alternarUm(uid) {
    setSelecionados((sel) => (sel.includes(uid) ? sel.filter((id) => id !== uid) : [...sel, uid]));
  }

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoFoto(arquivo);
    setPreviewFoto(URL.createObjectURL(arquivo));
  }

  async function handleEnviar() {
    if (selecionados.length === 0 || !texto.trim() || enviando) return;
    setEnviando(true);
    try {
      let fotoURL = '';
      if (arquivoFoto) {
        fotoURL = await uploadFotoCorreio(perfil.uid, arquivoFoto);
      }
      const opts = { fotoURL, fixada };
      if (selecionados.length === 1) {
        await sendMailMessage(perfil.uid, selecionados[0], texto.trim(), opts);
      } else {
        await sendMailToMultiple(perfil.uid, selecionados, texto.trim(), opts);
      }
      setTexto('');
      setArquivoFoto(null);
      setPreviewFoto('');
      setFixada(false);
      setSelecionados([]);
      setEnviado(true);
      setTimeout(() => setEnviado(false), 2000);
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-coffee-100 bg-cream-card">
        {/* Item 36 — selecionar todos */}
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

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escreva a mensagem..."
        rows={4}
        className="w-full resize-none rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
      />

      {/* Item 35 — anexar foto */}
      {previewFoto ? (
        <div className="relative w-32">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewFoto} alt="Prévia" className="w-full rounded-lg" />
          <button
            type="button"
            onClick={() => {
              setArquivoFoto(null);
              setPreviewFoto('');
            }}
            className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-coffee-800 text-cream"
          >
            <X size={12} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputFotoRef.current?.click()}
          className="rounded-lg border border-dashed border-coffee-200 px-3 py-2 text-xs font-medium text-coffee-500"
        >
          + Anexar foto (opcional)
        </button>
      )}
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        onChange={handleFotoChange}
        className="hidden"
      />

      {/* Item 34 — fixar no topo */}
      <label className="flex items-center gap-2 text-xs text-coffee-500">
        <input type="checkbox" checked={fixada} onChange={(e) => setFixada(e.target.checked)} />
        Fixar no topo do Correio de quem receber
      </label>

      <button
        onClick={handleEnviar}
        disabled={selecionados.length === 0 || !texto.trim() || enviando}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
      >
        {enviando && <Loader2 size={14} className="animate-spin" />}
        {enviado
          ? 'Enviado!'
          : `Enviar mensagem${selecionados.length > 1 ? ` (${selecionados.length} pessoas)` : ''}`}
      </button>
    </div>
  );
}
