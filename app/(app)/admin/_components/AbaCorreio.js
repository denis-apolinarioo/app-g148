'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Pin, Search, Trash2, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import {
  getAllUsers,
  sendMailMessage,
  sendMailToMultiple,
  subscribeToMailHistory,
  deleteMailMessage,
} from '@/lib/firestore-helpers';
import { uploadFotoCorreioComThumb } from '@/lib/storage';
import { combinaComBusca } from '@/lib/searchUtils';
import { formatDateTimeBR } from '@/lib/dateUtils';

export default function AbaCorreio() {
  const [usuarios, setUsuarios] = useState([]);
  const [busca, setBusca] = useState('');
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

  const usuariosFiltrados = useMemo(() => {
    if (!busca.trim()) return usuarios;
    return usuarios.filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca));
  }, [usuarios, busca]);

  const todosSelecionados =
    usuariosFiltrados.length > 0 && usuariosFiltrados.every((u) => selecionados.includes(u.id));

  function alternarTodos() {
    if (todosSelecionados) {
      const idsFiltrados = new Set(usuariosFiltrados.map((u) => u.id));
      setSelecionados((sel) => sel.filter((id) => !idsFiltrados.has(id)));
    } else {
      setSelecionados((sel) => [...new Set([...sel, ...usuariosFiltrados.map((u) => u.id)])]);
    }
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

  // CORREÇÃO DE VAZAMENTO: previewFoto (blob: local) nunca era revogada —
  // ficava viva mesmo trocando de foto ou fechando a tela sem enviar.
  // Revoga a anterior sempre que ela muda (nova foto) e também ao desmontar.
  useEffect(() => {
    return () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  async function handleEnviar() {
    if (selecionados.length === 0 || !texto.trim() || enviando) return;
    setEnviando(true);
    try {
      let fotoURL = '';
      let fotoThumbURL = '';
      if (arquivoFoto) {
        const resultado = await uploadFotoCorreioComThumb(perfil.uid, arquivoFoto);
        fotoURL = resultado.url;
        fotoThumbURL = resultado.thumbURL;
      }
      const opts = { fotoURL, fotoThumbURL, fixada };
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
      {/* Item 15º — busca de usuário, pra facilitar achar destinatário numa lista maior */}
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou @username..."
          className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
        />
      </div>

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
            Selecionar todos ({usuariosFiltrados.length})
          </span>
        </button>
        <div className="max-h-52 overflow-y-auto">
          {usuariosFiltrados.length === 0 && (
            <p className="px-3.5 py-3 text-center text-xs text-coffee-400">
              Ninguém encontrado com esse nome.
            </p>
          )}
          {usuariosFiltrados.map((u) => {
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

      <HistoricoMensagens usuarios={usuarios} />
    </div>
  );
}

// Item 14º do Bloco 7 — histórico de mensagens enviadas, geral ou por
// pessoa, com exclusão. Fica na mesma aba porque é a mesma área (Correio)
// do painel Admin.
function HistoricoMensagens({ usuarios }) {
  const [modo, setModo] = useState('geral'); // 'geral' | 'pessoa'
  const [buscaPessoa, setBuscaPessoa] = useState('');
  const [pessoaId, setPessoaId] = useState('');
  const [historico, setHistorico] = useState(null);
  const [apagandoId, setApagandoId] = useState(null);

  useEffect(() => {
    if (modo === 'pessoa' && !pessoaId) {
      setHistorico(null);
      return undefined;
    }
    setHistorico(null);
    const unsub = subscribeToMailHistory(setHistorico, modo === 'pessoa' ? pessoaId : null);
    return () => unsub();
  }, [modo, pessoaId]);

  const pessoasFiltradas = useMemo(() => {
    if (!buscaPessoa.trim()) return usuarios;
    return usuarios.filter(
      (u) => combinaComBusca(u.nome, buscaPessoa) || combinaComBusca(u.username, buscaPessoa)
    );
  }, [usuarios, buscaPessoa]);

  const pessoaSelecionada = usuarios.find((u) => u.id === pessoaId);

  async function handleApagar(msg) {
    if (!confirm('Apagar esta mensagem? Some do Correio de quem recebeu (mesmo se estiver fixada).')) {
      return;
    }
    setApagandoId(msg.id);
    try {
      await deleteMailMessage(msg.id);
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err);
    } finally {
      setApagandoId(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-coffee-100 pt-5">
      <h3 className="font-destaque text-sm font-semibold text-coffee-700">Histórico de mensagens</h3>

      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setModo('geral')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            modo === 'geral' ? 'bg-coffee-700 text-cream' : 'bg-cream-card text-coffee-500'
          }`}
        >
          Geral
        </button>
        <button
          type="button"
          onClick={() => setModo('pessoa')}
          className={`flex-1 rounded-lg py-2 text-xs font-semibold ${
            modo === 'pessoa' ? 'bg-coffee-700 text-cream' : 'bg-cream-card text-coffee-500'
          }`}
        >
          Por pessoa
        </button>
      </div>

      {modo === 'pessoa' && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
            />
            <input
              type="text"
              value={pessoaSelecionada ? pessoaSelecionada.nome : buscaPessoa}
              onChange={(e) => {
                setPessoaId('');
                setBuscaPessoa(e.target.value);
              }}
              placeholder="Buscar pessoa por nome ou @username..."
              className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
            />
          </div>
          {!pessoaId && buscaPessoa.trim() && (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-coffee-100 bg-cream-card">
              {pessoasFiltradas.length === 0 && (
                <p className="px-3 py-2.5 text-center text-xs text-coffee-400">Ninguém encontrado.</p>
              )}
              {pessoasFiltradas.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setPessoaId(u.id);
                    setBuscaPessoa('');
                  }}
                  className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3 py-2 last:border-b-0"
                >
                  <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
                  <span className="truncate text-sm text-coffee-700">{u.nome}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {modo === 'pessoa' && !pessoaId ? (
        <p className="text-xs text-coffee-300">Escolha uma pessoa pra ver o histórico com ela.</p>
      ) : historico === null ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-coffee-100/60" />
          ))}
        </div>
      ) : historico.length === 0 ? (
        <p className="text-xs text-coffee-300">Nenhuma mensagem enviada ainda.</p>
      ) : (
        <div className="space-y-2">
          {historico.map((msg) => {
            const destinatario = usuarios.find((u) => u.id === msg.destinatarioId);
            return (
              <div
                key={msg.id}
                className="flex items-start gap-2.5 rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-xs font-semibold text-coffee-700">
                    {msg.fixada && <Pin size={11} className="text-gold" fill="currentColor" />}
                    {modo === 'geral' ? destinatario?.nome || 'Alguém' : formatDateTimeBR(msg.createdAt)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-coffee-500">{msg.texto}</p>
                  {modo === 'geral' && (
                    <p className="mt-0.5 text-[11px] text-coffee-300">
                      {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleApagar(msg)}
                  disabled={apagandoId === msg.id}
                  aria-label="Apagar mensagem"
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
                >
                  {apagandoId === msg.id ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
