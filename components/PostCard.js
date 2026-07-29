'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Trash2, Pencil, Check, X as XIcon } from 'lucide-react';
import Avatar from '@/components/Avatar';
import CommentSection from '@/components/CommentSection';
import TextoComLinks from '@/components/TextoComLinks';
import ImageViewerModal from '@/components/ImageViewerModal';
import LikesListModal from '@/components/LikesListModal';
import { toggleLike, deletePost, updatePost } from '@/lib/firestore-helpers';
import { removerPontosPost } from '@/lib/points';
import { getUsuarioCache } from '@/lib/usersCache';
import { getCachedImageURL } from '@/lib/imageCache';
import { formatDateTimeBR } from '@/lib/dateUtils';

const JANELA_DUPLO_TOQUE = 300; // ms — intervalo pra reconhecer 2 toques como "duplo toque"
const DURACAO_LONG_PRESS = 500; // ms — tempo segurando pra abrir "quem curtiu"

export default function PostCard({ post, usuarioAtual }) {
  const [autor, setAutor] = useState(null);
  const [midiaURL, setMidiaURL] = useState('');
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [imagemAberta, setImagemAberta] = useState(false);
  const [curtindo, setCurtindo] = useState(false);
  const [coracaoAnimado, setCoracaoAnimado] = useState(false);
  const [mostrarCurtidas, setMostrarCurtidas] = useState(false);
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(post.texto || '');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  const ultimoTapRef = useRef(0);
  const timeoutTapRef = useRef(null);
  const pressTimerRef = useRef(null);
  const longPressAtivoRef = useRef(false);

  const jaCurtiu = post.curtidas?.includes(usuarioAtual?.uid);
  const ehDono = usuarioAtual?.uid === post.autorId;
  const ehAdmin = usuarioAtual?.isAdmin;

  useEffect(() => {
    getUsuarioCache(post.autorId).then(setAutor);
  }, [post.autorId]);

  useEffect(() => {
    if (post.midiaURL) {
      getCachedImageURL(post.midiaURL).then(setMidiaURL);
    }
  }, [post.midiaURL]);

  // Limpa timers pendentes se o card sair da tela no meio de um toque
  useEffect(() => {
    return () => {
      if (timeoutTapRef.current) clearTimeout(timeoutTapRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  async function handleLike() {
    if (!usuarioAtual || curtindo) return;
    setCurtindo(true);
    try {
      await toggleLike(post.id, usuarioAtual.uid, jaCurtiu, {
        postAutorId: post.autorId,
        remetente: usuarioAtual,
      });
    } finally {
      setCurtindo(false);
    }
  }

  // Item 19 — duplo toque curte (nunca descurte) e mostra a animação do coração
  function dispararCurtidaComAnimacao() {
    if (!jaCurtiu) handleLike();
    setCoracaoAnimado(true);
    setTimeout(() => setCoracaoAnimado(false), 700);
  }

  // Toque na FOTO precisa distinguir toque único (abre a foto em tela cheia)
  // de duplo toque (curte) — por isso espera um instante antes de decidir.
  function handleTapNaFoto() {
    const agora = Date.now();
    const desdeUltimoTap = agora - ultimoTapRef.current;
    ultimoTapRef.current = agora;

    if (desdeUltimoTap < JANELA_DUPLO_TOQUE) {
      if (timeoutTapRef.current) {
        clearTimeout(timeoutTapRef.current);
        timeoutTapRef.current = null;
      }
      dispararCurtidaComAnimacao();
    } else {
      timeoutTapRef.current = setTimeout(() => {
        setImagemAberta(true);
        timeoutTapRef.current = null;
      }, JANELA_DUPLO_TOQUE);
    }
  }

  // Toque no TEXTO só precisa reconhecer o duplo toque (não tem ação de
  // toque único concorrendo, então não precisa de delay/timeout)
  function handleTapNoTexto() {
    const agora = Date.now();
    if (agora - ultimoTapRef.current < JANELA_DUPLO_TOQUE) {
      dispararCurtidaComAnimacao();
    }
    ultimoTapRef.current = agora;
  }

  // Item 18 — segurar o botão de curtir mostra quem curtiu, sem curtir/descurtir
  function iniciarPressionar() {
    longPressAtivoRef.current = false;
    pressTimerRef.current = setTimeout(() => {
      longPressAtivoRef.current = true;
      setMostrarCurtidas(true);
    }, DURACAO_LONG_PRESS);
  }
  function cancelarPressionar() {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }
  function handleClickCurtir() {
    if (longPressAtivoRef.current) {
      longPressAtivoRef.current = false;
      return; // já abriu "quem curtiu" no long-press, não alterna curtida
    }
    handleLike();
  }

  async function handleDelete() {
    if (!confirm('Apagar este post?')) return;
    await deletePost(post.id);
    // Item 17 — remove os pontos ganhos por este post (se houver)
    if (post.pontosGanhos) {
      try {
        await removerPontosPost(post.autorId, post.id, post.pontosGanhos);
      } catch (err) {
        console.error('Erro ao remover pontos do post apagado:', err);
      }
    }
  }

  // Item 15 — Editar post (só o texto/legenda; a mídia não muda)
  function handleAbrirEdicao() {
    setTextoEdit(post.texto || '');
    setEditando(true);
  }
  async function handleSalvarEdicao() {
    if (salvandoEdicao) return;
    setSalvandoEdicao(true);
    try {
      await updatePost(post.id, { texto: textoEdit.trim() });
      setEditando(false);
    } catch (err) {
      console.error('Erro ao editar post:', err);
    } finally {
      setSalvandoEdicao(false);
    }
  }

  return (
    <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
      {/* Cabeçalho — nome e avatar levam ao perfil do autor */}
      <div className="mb-3 flex items-center gap-2.5">
        <Link href={`/u/${autor?.username || post.autorId}`} className="flex-shrink-0">
          <Avatar src={autor?.fotoURL} nome={autor?.nome || ''} tamanho={36} />
        </Link>
        <div className="flex-1 min-w-0">
          <Link
            href={`/u/${autor?.username || post.autorId}`}
            className="truncate text-sm font-semibold text-coffee-800 hover:underline block"
          >
            {autor?.nome || '...'}
          </Link>
          <p className="text-[11px] text-coffee-400">
            {post.createdAt?.toDate ? formatDateTimeBR(post.createdAt) : ''}
            {post.editadoEm && ' · editado'}
          </p>
        </div>
        {post.categoria && (
          <span className="rounded-full border border-coffee-200 px-2.5 py-0.5 text-[10px] font-medium text-coffee-500">
            {post.categoria}
          </span>
        )}
        {ehDono && !editando && (
          <button onClick={handleAbrirEdicao} className="text-coffee-200 hover:text-coffee-600" aria-label="Editar post">
            <Pencil size={15} />
          </button>
        )}
        {(ehDono || ehAdmin) && (
          <button onClick={handleDelete} className="text-coffee-200 hover:text-red-500" aria-label="Apagar post">
            <Trash2 size={15} />
          </button>
        )}
      </div>

      {/* Texto — modo normal ou modo edição */}
      {editando ? (
        <div className="mb-3">
          <textarea
            value={textoEdit}
            onChange={(e) => setTextoEdit(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-coffee-100 bg-cream p-3 text-sm text-coffee-800"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              onClick={() => setEditando(false)}
              className="flex items-center gap-1 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-500"
            >
              <XIcon size={13} /> Cancelar
            </button>
            <button
              onClick={handleSalvarEdicao}
              disabled={salvandoEdicao}
              className="flex items-center gap-1 rounded-full bg-coffee-700 px-3 py-1.5 text-xs font-semibold text-cream disabled:opacity-50"
            >
              <Check size={13} /> Salvar
            </button>
          </div>
        </div>
      ) : (
        post.texto && (
          <div onClick={handleTapNoTexto} className="relative">
            <TextoComLinks
              texto={post.texto}
              className="mb-3 text-sm leading-relaxed text-coffee-700"
            />
          </div>
        )
      )}

      {/* Foto — toque único abre em tela cheia, duplo toque curte (item 19) */}
      {post.tipo === 'foto' && midiaURL && (
        <button
          onClick={handleTapNaFoto}
          className="relative mb-3 block w-full overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={midiaURL}
            alt="Foto do post"
            className="w-full object-cover max-h-80"
          />
          {coracaoAnimado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={72} className="animate-curtidaPop text-white drop-shadow-lg" fill="currentColor" />
            </span>
          )}
        </button>
      )}

      {/* Áudio — os controles nativos (play, barra) ocupam todo o espaço
          clicável deles, então o duplo toque não pode ficar "em cima" do
          áudio (senão nunca sobra clique pra reconhecer o gesto, e ainda
          atrapalha o play/pause). Por isso criamos um cartão ao redor do
          player, com uma faixa de toque própria (acima) livre pra curtir. */}
      {post.tipo === 'audio' && post.midiaURL && (
        <div
          onClick={handleTapNoTexto}
          className="relative mb-3 rounded-xl border border-coffee-100 bg-cream px-3 pb-3 pt-4"
        >
          <p className="pointer-events-none mb-2 text-center text-[11px] text-coffee-300">
            toque duas vezes para curtir
          </p>
          <div onClick={(e) => e.stopPropagation()}>
            <audio controls src={post.midiaURL} className="w-full" />
          </div>
          {coracaoAnimado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={56} className="animate-curtidaPop text-red-500 drop-shadow-lg" fill="currentColor" />
            </span>
          )}
        </div>
      )}

      {/* Rodapé */}
      <div className="flex items-center gap-4 pt-1">
        <button
          onClick={handleClickCurtir}
          onMouseDown={iniciarPressionar}
          onMouseUp={cancelarPressionar}
          onMouseLeave={cancelarPressionar}
          onTouchStart={iniciarPressionar}
          onTouchEnd={cancelarPressionar}
          disabled={curtindo}
          className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
            jaCurtiu ? 'text-red-500' : 'text-coffee-300 hover:text-red-400'
          }`}
        >
          <Heart size={17} fill={jaCurtiu ? 'currentColor' : 'none'} />
          {post.curtidas?.length || 0}
        </button>

        <button
          onClick={() => setMostrarComentarios((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-coffee-300 hover:text-coffee-600"
        >
          <MessageCircle size={17} />
          {post.comentariosCount || 0}
        </button>
      </div>

      {mostrarComentarios && (
        <CommentSection postId={post.id} postAutorId={post.autorId} usuarioAtual={usuarioAtual} />
      )}

      {imagemAberta && (
        <ImageViewerModal
          src={midiaURL}
          alt="Foto do post"
          onClose={() => setImagemAberta(false)}
        />
      )}

      {mostrarCurtidas && (
        <LikesListModal uids={post.curtidas || []} onClose={() => setMostrarCurtidas(false)} />
      )}
    </div>
  );
}
