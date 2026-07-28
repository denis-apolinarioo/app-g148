'use client';

import { useState, useRef } from 'react';
import { X, Image as ImageIcon, Mic as MicIcon, Type, Loader2 } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { createPost } from '@/lib/firestore-helpers';
import { pontuarPostMural } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { uploadFoto, uploadAudio } from '@/lib/storage';
import AudioRecorderButton from '@/components/AudioRecorderButton';

const CATEGORIAS = [null, 'Relato', 'Oração'];

export default function CreatePostSheet({ onFechar, onPublicado }) {
  const { perfil } = useAuth();
  const [aba, setAba] = useState('texto'); // texto | foto | audio
  const [texto, setTexto] = useState('');
  const [categoria, setCategoria] = useState(null);
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [blobAudio, setBlobAudio] = useState(null);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoRef = useRef(null);

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    setArquivoFoto(arquivo);
    setPreviewFoto(URL.createObjectURL(arquivo));
  }

  const podePublicar =
    (aba === 'texto' && texto.trim()) ||
    (aba === 'foto' && arquivoFoto) ||
    (aba === 'audio' && blobAudio);

  async function handlePublicar() {
    if (!podePublicar || publicando) return;
    setPublicando(true);
    setErro('');

    try {
      let tipo = 'texto';
      let midiaURL = '';

      if (aba === 'foto' && arquivoFoto) {
        tipo = 'foto';
        midiaURL = await uploadFoto(perfil.uid, arquivoFoto);
      } else if (aba === 'audio' && blobAudio) {
        tipo = 'audio';
        midiaURL = await uploadAudio(perfil.uid, blobAudio);
      }

      const postId = await createPost({
        autor: perfil,
        tipo,
        texto: texto.trim(),
        midiaURL,
        categoria,
      });

      await pontuarPostMural(perfil.uid, postId);
      await verificarConquistas(perfil.uid, perfil.streakAtual || 0, 'post');

      onPublicado?.();
      onFechar();
    } catch (err) {
      console.error('Erro ao publicar post:', err);
      setErro(
        'Não foi possível publicar agora. Verifique sua internet — se o problema for o Storage do Firebase (upload de mídia), confirme que o plano Blaze está ativo.'
      );
    } finally {
      setPublicando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-coffee-900/40 sm:items-center">
      <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">Nova publicação</h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4 flex items-center gap-2 border-b border-coffee-100">
            <AbaBtn ativo={aba === 'texto'} onClick={() => setAba('texto')} icone={Type} label="Texto" />
            <AbaBtn ativo={aba === 'foto'} onClick={() => setAba('foto')} icone={ImageIcon} label="Foto" />
            <AbaBtn ativo={aba === 'audio'} onClick={() => setAba('audio')} icone={MicIcon} label="Áudio" />
          </div>

          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={aba === 'texto' ? 'No que você está pensando?' : 'Adicione uma legenda (opcional)'}
            rows={4}
            className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800 placeholder:text-coffee-300"
          />

          {aba === 'foto' && (
            <div className="mt-3">
              {previewFoto ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewFoto}
                  alt="Prévia"
                  onClick={() => inputFotoRef.current?.click()}
                  className="max-h-64 w-full cursor-pointer rounded-xl object-cover"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => inputFotoRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-coffee-200 py-8 text-coffee-400"
                >
                  <ImageIcon size={26} />
                  <span className="text-sm">Escolher foto</span>
                </button>
              )}
              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="hidden"
              />
            </div>
          )}

          {aba === 'audio' && (
            <div className="mt-3">
              <AudioRecorderButton onGravado={setBlobAudio} onLimpar={() => setBlobAudio(null)} />
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-coffee-500">Categoria (opcional)</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIAS.map((c) => (
                <button
                  key={c || 'nenhuma'}
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                    categoria === c
                      ? 'border-coffee-700 bg-coffee-700 text-cream'
                      : 'border-coffee-200 text-coffee-500'
                  }`}
                >
                  {c || 'Nenhuma'}
                </button>
              ))}
            </div>
          </div>

          {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}

          <button
            onClick={handlePublicar}
            disabled={!podePublicar || publicando}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            {publicando && <Loader2 size={16} className="animate-spin" />}
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}

function AbaBtn({ ativo, onClick, icone: Icone, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-1 pb-2.5 text-sm font-medium ${
        ativo ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
      }`}
    >
      <Icone size={15} />
      {label}
    </button>
  );
}
