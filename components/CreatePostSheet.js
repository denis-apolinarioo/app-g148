'use client';

import { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { X, Image as ImageIcon, Mic as MicIcon, Type, Loader2, Camera } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { createPost } from '@/lib/firestore-helpers';
import { pontuarPostFeed } from '@/lib/points';
import { registrarAcaoCategoria } from '@/lib/acoesLog';
import { getTodasAsCategoriasAcao } from '@/lib/categoriasAcaoRepo';
import { verificarConquistas } from '@/lib/achievements';
import { uploadFotoComThumb, uploadAudio } from '@/lib/storage';
import AudioRecorderButton from '@/components/AudioRecorderButton';
import ImageCropper from '@/components/ImageCropper';
import { useProtecaoCliqueDuplo } from '@/lib/useProtecaoCliqueDuplo';

const PROPORCOES = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
];

export default function CreatePostSheet({ onFechar, onPublicado }) {
  const { perfil } = useAuth();
  const [aba, setAba] = useState('texto');
  const [texto, setTexto] = useState('');
  // FASE 3 — categoria escolhida entre as configuráveis pelo Admin (aba
  // Categorias). `null` = "Nenhuma", mesmo comportamento de antes (pontua o
  // valor padrão de post no Feed, editável em Admin > Ações).
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [categoria, setCategoria] = useState(null);
  const [arquivoFoto, setArquivoFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [srcCorte, setSrcCorte] = useState(''); // URL da imagem bruta pra tela de corte
  const [blobAudio, setBlobAudio] = useState(null);
  const [publicando, setPublicando] = useState(false);
  const [erro, setErro] = useState('');
  const inputFotoRef = useRef(null);
  const inputCameraRef = useRef(null);
  // Item 17 do Bloco 9 — debounce simples pra ignorar duplo toque rápido.
  const emDebouncePublicar = useProtecaoCliqueDuplo();

  // CORREÇÃO: o ImageCropper espera receber a prop "src" (uma URL), não o
  // arquivo bruto. Por isso a tela de corte fechava/travava ao tirar foto ou
  // escolher da galeria num post — a imagem nunca era carregada.
  function abrirCorte(arquivo) {
    setSrcCorte(URL.createObjectURL(arquivo));
  }

  function handleFotoChange(e) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    abrirCorte(arquivo);
  }

  function fecharCorte() {
    if (srcCorte) URL.revokeObjectURL(srcCorte);
    setSrcCorte('');
  }

  function handleCortado(blob) {
    fecharCorte();
    const file = new File([blob], 'foto.jpg', { type: 'image/jpeg' });
    setArquivoFoto(file);
    setPreviewFoto(URL.createObjectURL(blob));
  }

  // CORREÇÃO DE VAZAMENTO: previewFoto (blob: local) nunca era revogada —
  // ficava viva mesmo trocando de foto ou fechando a tela sem publicar.
  // Revoga a anterior sempre que ela muda (nova foto) e também ao desmontar.
  useEffect(() => {
    return () => {
      if (previewFoto) URL.revokeObjectURL(previewFoto);
    };
  }, [previewFoto]);

  // FASE 3 — carrega as categorias ativas cadastradas pelo Admin (aba
  // Categorias). Se nenhuma foi criada ainda, o seletor mostra só "Nenhuma"
  // — mesmo visual de antes da Fase 3.
  useEffect(() => {
    getTodasAsCategoriasAcao().then((todas) => {
      setCategoriasDisponiveis(todas.filter((c) => c.ativa !== false));
    });
  }, []);

  const podePublicar =
    (aba === 'texto' && texto.trim()) ||
    (aba === 'foto' && arquivoFoto) ||
    (aba === 'audio' && blobAudio);

  async function handlePublicar() {
    if (!podePublicar || publicando || emDebouncePublicar()) return;
    setPublicando(true);
    setErro('');
    try {
      let tipo = 'texto';
      let midiaURL = '';
      let midiaThumbURL = '';

      if (aba === 'foto' && arquivoFoto) {
        tipo = 'foto';
        const resultado = await uploadFotoComThumb(perfil.uid, arquivoFoto);
        midiaURL = resultado.url;
        midiaThumbURL = resultado.thumbURL;
      } else if (aba === 'audio' && blobAudio) {
        tipo = 'audio';
        midiaURL = await uploadAudio(perfil.uid, blobAudio);
      }

      const postId = await createPost({
        autor: perfil,
        tipo,
        texto: texto.trim(),
        midiaURL,
        midiaThumbURL,
        categoria: categoria?.nome || null,
        categoriaAcaoId: categoria?.id || null,
      });

      // FASE 3 — com categoria escolhida, a pontuação/Dracma seguem o que o
      // Admin configurou pra ela (aba Categorias); sem categoria, mantém o
      // comportamento de sempre (pontos fixos de "Post no Feed", editável em
      // Admin > Ações).
      if (categoria?.id) {
        const resultado = await registrarAcaoCategoria(perfil.uid, categoria.id, 'post', postId);
        if (resultado.pontosGanhos > 0 || resultado.dracmaGanho > 0) {
          await updateDoc(doc(db, 'posts', postId), {
            pontosGanhos: resultado.pontosGanhos,
            dracmaGanho: resultado.dracmaGanho,
          });
        }
      } else {
        await pontuarPostFeed(perfil.uid, postId);
      }
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

  // Tela de corte sobrepõe tudo
  if (srcCorte) {
    return (
      <ImageCropper
        src={srcCorte}
        razao={{ w: 4, h: 5 }}
        opcoes={PROPORCOES}
        onConfirmar={handleCortado}
        onCancelar={fecharCorte}
      />
    );
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
                <button
                  type="button"
                  onClick={() => abrirCorte(arquivoFoto)}
                  className="relative block w-full overflow-hidden rounded-xl"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewFoto} alt="Prévia" className="max-h-64 w-full object-cover" />
                  <span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2.5 py-1 text-[11px] text-white">
                    Toque para recortar
                  </span>
                </button>
              ) : (
                <div className="flex gap-3">
                  {/* Galeria */}
                  <button
                    type="button"
                    onClick={() => inputFotoRef.current?.click()}
                    className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-coffee-200 py-7 text-coffee-400"
                  >
                    <ImageIcon size={24} />
                    <span className="text-xs">Galeria</span>
                  </button>
                  {/* Câmera */}
                  <button
                    type="button"
                    onClick={() => inputCameraRef.current?.click()}
                    className="flex flex-1 flex-col items-center gap-2 rounded-xl border-2 border-dashed border-coffee-200 py-7 text-coffee-400"
                  >
                    <Camera size={24} />
                    <span className="text-xs">Câmera</span>
                  </button>
                </div>
              )}

              <input
                ref={inputFotoRef}
                type="file"
                accept="image/*"
                onChange={handleFotoChange}
                className="hidden"
              />
              {/* capture="environment" abre direto a câmera traseira */}
              <input
                ref={inputCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
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
              <button
                onClick={() => setCategoria(null)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  !categoria
                    ? 'border-coffee-700 bg-coffee-700 text-cream'
                    : 'border-coffee-200 text-coffee-500'
                }`}
              >
                Nenhuma
              </button>
              {categoriasDisponiveis.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoria(c)}
                  className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                    categoria?.id === c.id
                      ? 'border-coffee-700 bg-coffee-700 text-cream'
                      : 'border-coffee-200 text-coffee-500'
                  }`}
                >
                  {c.nome}
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
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium ${
        ativo
          ? 'border-coffee-700 text-coffee-800'
          : 'border-transparent text-coffee-400'
      }`}
    >
      <Icone size={16} />
      {label}
    </button>
  );
}
