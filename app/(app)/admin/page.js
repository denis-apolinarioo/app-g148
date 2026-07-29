'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import LoadingScreen from '@/components/LoadingScreen';
import EmptyState from '@/components/EmptyState';
import Avatar from '@/components/Avatar';
import { MISSOES_DIARIAS, MISSOES_SEMANAIS, MISSOES_MENSAIS } from '@/lib/constants';
import { getPontosEfetivos, salvarPontosDaMissao } from '@/lib/missionOverrides';
import {
  getAllUsers,
  createChallenge,
  subscribeToPendingChallenges,
  sendMailMessage,
  sendMailToMultiple,
} from '@/lib/firestore-helpers';
import { uploadFotoCorreio } from '@/lib/storage';
import { aprovarDesafio, rejeitarDesafio } from '@/lib/points';
import { ShieldAlert, Check, X, Loader2, Save } from 'lucide-react';

const ABAS = ['Pontos', 'Usuários', 'Desafios', 'Correio'];

export default function AdminPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const [aba, setAba] = useState('Pontos');

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
        {aba === 'Pontos' && <AbaPontos />}
        {aba === 'Usuários' && <AbaUsuarios />}
        {aba === 'Desafios' && <AbaDesafios />}
        {aba === 'Correio' && <AbaCorreio />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function AbaPontos() {
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
        Altere os pontos de qualquer missão. A mudança vale a partir de agora — pontos já
        creditados no passado não mudam.
      </p>
      <GrupoPontos titulo="Diárias" missoes={MISSOES_DIARIAS} mapa={mapaPontos} onSalvar={handleSalvar} salvandoId={salvandoId} salvoId={salvoId} />
      <GrupoPontos titulo="Semanais" missoes={MISSOES_SEMANAIS} mapa={mapaPontos} onSalvar={handleSalvar} salvandoId={salvandoId} salvoId={salvoId} />
      <GrupoPontos titulo="Mensais" missoes={MISSOES_MENSAIS} mapa={mapaPontos} onSalvar={handleSalvar} salvandoId={salvandoId} salvoId={salvoId} />
      <GrupoPontos
        titulo="Outras ações"
        missoes={[{ id: 'postarNoFeed', titulo: 'Post no Feed' }]}
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
