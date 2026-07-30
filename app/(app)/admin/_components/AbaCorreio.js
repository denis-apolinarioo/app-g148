'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, X } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { getAllUsers, sendMailMessage, sendMailToMultiple } from '@/lib/firestore-helpers';
import { uploadFotoCorreio } from '@/lib/storage';

export default function AbaCorreio() {
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
