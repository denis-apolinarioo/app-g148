'use client';

import { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { X, Image as ImageIcon, Camera } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { db } from '@/lib/firebase';
import { createPost } from '@/lib/firestore-helpers';
import { pontuarPostFeed } from '@/lib/points';
import { registrarAcaoCategoria } from '@/lib/acoesLog';
import { getTodasAsCategoriasAcao } from '@/lib/categoriasAcaoRepo';
import { dentroDaJanelaHorario } from '@/lib/dateUtils';
import { verificarConquistas } from '@/lib/achievements';
import { uploadFotoComThumb, uploadAudio } from '@/lib/storage';
import AudioRecorderButton from '@/components/AudioRecorderButton';
import ImageCropper, { PROPORCAO_ORIGINAL } from '@/components/ImageCropper';
import { useProtecaoCliqueDuplo } from '@/lib/useProtecaoCliqueDuplo';
import { useToast } from '@/components/ToastProvider';

const PROPORCOES = [
  { label: '1:1', w: 1, h: 1 },
  { label: '4:5', w: 4, h: 5 },
  { label: '3:4', w: 3, h: 4 },
  { label: 'Original', w: PROPORCAO_ORIGINAL, h: PROPORCAO_ORIGINAL },
];

export default function CreatePostSheet({ onFechar, onPublicado, rascunhoInicial, onPublicarOtimista, onConfirmarPublicado, onErroPublicar }) {
  const { perfil } = useAuth();
  const mostrarToast = useToast();
  // PUBLICAÇÃO OTIMISTA — quando a tela reabre depois de um erro de envio
  // (ver onErroPublicar), `rascunhoInicial` traz de volta exatamente o que
  // a pessoa tinha digitado/escolhido, pra não perder nada.
  const [texto, setTexto] = useState(rascunhoInicial?.texto || '');
  // FASE 3 — categoria escolhida entre as configuráveis pelo Admin (Admin >
  // Ações > Ações específicas). `null` = "Nenhuma", mesmo comportamento de
  // antes (pontua o valor padrão de post no Feed, editável em Admin > Ações
  // > Ações básicas).
  const [categoriasDisponiveis, setCategoriasDisponiveis] = useState([]);
  const [categoria, setCategoria] = useState(rascunhoInicial?.categoria || null);
  const [arquivoFoto, setArquivoFoto] = useState(rascunhoInicial?.arquivoFoto || null);
  const [previewFoto, setPreviewFoto] = useState('');
  const [srcCorte, setSrcCorte] = useState(''); // URL da imagem bruta pra tela de corte
  const [blobAudio, setBlobAudio] = useState(rascunhoInicial?.blobAudio || null);
  // Duração aproximada (segundos) do áudio gravado — usada só pra
  // conquistas que exigem duração mínima (ex.: "Arautos da Shoppe").
  const [duracaoAudio, setDuracaoAudio] = useState(rascunhoInicial?.duracaoAudio || 0);
  const [erro, setErro] = useState(rascunhoInicial ? 'Não foi possível publicar agora. Verifique sua internet e tente de novo.' : '');
  const inputFotoRef = useRef(null);
  const inputCameraRef = useRef(null);
  // Item 17 do Bloco 9 — debounce simples pra ignorar duplo toque rápido.
  const emDebouncePublicar = useProtecaoCliqueDuplo();

  // Reconstrói a prévia da foto a partir do arquivo trazido pelo rascunho
  // (o blob: URL antigo já foi revogado quando a tela fechou da vez
  // passada — ver limpeza de previewFoto mais abaixo).
  useEffect(() => {
    if (rascunhoInicial?.arquivoFoto) {
      setPreviewFoto(URL.createObjectURL(rascunhoInicial.arquivoFoto));
    }
    if (rascunhoInicial) {
      mostrarToast('Não foi possível publicar. Tente novamente.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // FASE 3 — carrega as categorias ativas cadastradas pelo Admin (Admin >
  // Ações > Ações específicas). Se nenhuma foi criada ainda, o seletor
  // mostra só "Nenhuma" — mesmo visual de antes da Fase 3.
  useEffect(() => {
    getTodasAsCategoriasAcao().then((todas) => {
      setCategoriasDisponiveis(
        todas.filter(
          (c) => c.ativa !== false && (!c.horarioAtivo || dentroDaJanelaHorario(c.horarioInicio, c.horarioFim))
        )
      );
    });
  }, []);

  // SEM ABAS — texto, foto e áudio ficam todos visíveis ao mesmo tempo
  // (empilhados), então "o que a pessoa preencheu" já basta pra saber se dá
  // pra publicar. Cada publicação só carrega uma mídia (foto OU áudio, nunca
  // as duas — ver prioridade `foto > áudio` mais abaixo), mas o texto
  // funciona como legenda independente do que for anexado.
  const podePublicarConteudo = texto.trim() || arquivoFoto || blobAudio;

  // FASE — categoria pode exigir imagem/texto/áudio (configurado em Admin >
  // Ações > Ações específicas). `exigenciasPendentes` lista só o que ainda
  // falta, e vai encolhendo conforme a pessoa preenche cada campo.
  const exigenciasPendentes = [];
  if (categoria?.exigeTexto && !texto.trim()) exigenciasPendentes.push('texto');
  if (categoria?.exigeImagem && !arquivoFoto) exigenciasPendentes.push('imagem');
  if (categoria?.exigeAudio && !blobAudio) exigenciasPendentes.push('áudio');

  const podePublicar = podePublicarConteudo && exigenciasPendentes.length === 0;

  // PUBLICAÇÃO OTIMISTA — a tela fecha NA HORA, antes do post existir de
  // verdade no Firestore. O que a pessoa via de esperar antes (upload da
  // foto/áudio + gravação do post) agora acontece em segundo plano, com um
  // card provisório aparecendo na hora no topo do Feed (ver
  // PostCardOtimista.js e handlePublicarOtimista em FeedPage). Como esse
  // upload/gravação praticamente nunca falha (a não ser sem internet), o
  // ganho de velocidade percebida vale a troca — e no raro caso de erro, a
  // pessoa volta pra esta mesma tela com tudo que tinha preenchido (ver
  // onErroPublicar), sem precisar redigitar nada.
  async function handlePublicar() {
    if (!podePublicar || emDebouncePublicar()) return;
    setErro('');

    // Prioridade foto > áudio quando (raramente) as duas estiverem
    // preenchidas ao mesmo tempo — cada post só guarda uma mídia.
    const tipoOtimista = arquivoFoto ? 'foto' : blobAudio ? 'audio' : 'texto';
    // URL própria pro card otimista (independente da preview da tela, que
    // é revogada quando a tela fecha) — quem cuida de revogar essa aqui é o
    // FeedPage, quando o post otimista sai da lista (ver handleConfirmarPublicado/handleErroPublicar).
    const midiaURLLocal = tipoOtimista === 'foto' && arquivoFoto ? URL.createObjectURL(arquivoFoto) : '';
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const rascunho = { texto, categoria, arquivoFoto, blobAudio, duracaoAudio };

    onPublicarOtimista?.({
      id: tempId,
      postIdReal: null,
      tipo: tipoOtimista,
      texto: texto.trim(),
      midiaURLLocal,
      categoria: categoria?.nome || null,
      criadoEm: new Date(),
    });
    onFechar();

    try {
      let tipo = 'texto';
      let midiaURL = '';
      let midiaThumbURL = '';

      if (arquivoFoto) {
        tipo = 'foto';
        const resultado = await uploadFotoComThumb(perfil.uid, arquivoFoto);
        midiaURL = resultado.url;
        midiaThumbURL = resultado.thumbURL;
      } else if (blobAudio) {
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
        audioDuracaoSegundos: tipo === 'audio' ? duracaoAudio : null,
      });

      onConfirmarPublicado?.(tempId, postId, midiaURLLocal);

      // PERFORMANCE — a partir daqui o post já existe de verdade: já foi
      // salvo no Firestore e já apareceu no Feed de todo mundo (o listener
      // em tempo real do Feed pega o post assim que este createPost grava,
      // ver subscribeToFeed em lib/firestore-helpers.js). O que falta é só
      // a "burocracia" de pontos/Dracma/conquistas, que NUNCA deveria travar
      // a tela (ver o comentário no topo de lib/achievements.js) — então
      // roda em segundo plano também, sem afetar o card já mostrado.
      finalizarPontuacaoDoPost(postId).catch((err) => {
        console.error('Erro ao pontuar/verificar conquistas do post:', err);
      });

      onPublicado?.();
    } catch (err) {
      console.error('Erro ao publicar post:', err);
      onErroPublicar?.(tempId, rascunho, midiaURLLocal);
    }
  }

  // Pontos, Dracma e conquistas do post recém-criado — separado de
  // handlePublicar de propósito pra poder rodar em segundo plano (ver
  // comentário acima). Mesma lógica de sempre, só não bloqueia mais o
  // fechamento da tela.
  async function finalizarPontuacaoDoPost(postId) {
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
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h2 className="font-destaque text-lg font-semibold text-coffee-800">Nova publicação</h2>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="px-5 py-4">
          {/* SEM ABAS — texto, imagem e áudio aparecem sempre em fila (nessa
              ordem), sem precisar clicar em nada pra trocar de seção.
              Cada post só carrega uma mídia: anexar foto esconde a seção de
              áudio (e vice-versa) pra não ter as duas ao mesmo tempo; o
              texto funciona como legenda em qualquer caso. */}
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="No que você está pensando?"
            rows={4}
            className="w-full resize-none rounded-xl border border-coffee-100 bg-cream-card p-3.5 text-sm text-coffee-800 placeholder:text-coffee-300"
          />

          {!blobAudio && (
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
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-coffee-200 py-4 text-coffee-400"
                  >
                    <ImageIcon size={20} />
                    <span className="text-xs">Galeria</span>
                  </button>
                  {/* Câmera */}
                  <button
                    type="button"
                    onClick={() => inputCameraRef.current?.click()}
                    className="flex flex-1 flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-coffee-200 py-4 text-coffee-400"
                  >
                    <Camera size={20} />
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

          {!arquivoFoto && (
            <div className="mt-3">
              <AudioRecorderButton
                onGravado={(blob, segundos) => {
                  setBlobAudio(blob);
                  setDuracaoAudio(segundos || 0);
                }}
                onLimpar={() => {
                  setBlobAudio(null);
                  setDuracaoAudio(0);
                }}
              />
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-coffee-500">Categoria (opcional)</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setCategoria(null)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  !categoria
                    ? 'border-forte bg-forte text-cream'
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
                      ? 'border-forte bg-forte text-cream'
                      : 'border-coffee-200 text-coffee-500'
                  }`}
                >
                  {c.nome}
                </button>
              ))}
            </div>
            {categoria && exigenciasPendentes.length > 0 && (
              <p className="mt-2 text-[11px] text-amber-700">
                Esta categoria exige: {exigenciasPendentes.join(', ')}.
              </p>
            )}
          </div>

          {erro && <p className="mt-3 text-sm text-red-700">{erro}</p>}

          <button
            onClick={handlePublicar}
            disabled={!podePublicar}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3.5 text-sm font-semibold text-cream disabled:opacity-40"
          >
            Publicar
          </button>
        </div>
      </div>
    </div>
  );
}
