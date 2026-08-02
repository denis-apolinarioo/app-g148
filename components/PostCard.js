'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Heart,
  MessageCircle,
  Trash2,
  Pencil,
  Flag,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Link2,
  Eye,
  EyeOff,
} from 'lucide-react';
import Avatar from '@/components/Avatar';
import CommentSection from '@/components/CommentSection';
import TextoComLinks from '@/components/TextoComLinks';
import ImageViewerModal from '@/components/ImageViewerModal';
import LikesListModal from '@/components/LikesListModal';
import EditarPostModal from '@/components/EditarPostModal';
import { toggleLike, deletePost, createReport, alternarOcultarPost } from '@/lib/firestore-helpers';
import { removerPontosPost } from '@/lib/points';
import { getUsuarioCache } from '@/lib/usersCache';
import { getCachedImageURL } from '@/lib/imageCache';
import { formatDateTimeBR, postAindaEditavel } from '@/lib/dateUtils';
import { useAcaoOtimista } from '@/lib/useAcaoOtimista';
import { useProtecaoCliqueDuplo } from '@/lib/useProtecaoCliqueDuplo';
import { estaOffline } from '@/lib/connectivity';
import { enfileirarAcaoOffline } from '@/lib/offlineQueue';

const JANELA_DUPLO_TOQUE = 300; // ms — intervalo pra reconhecer 2 toques como "duplo toque"
const DURACAO_LONG_PRESS = 500; // ms — tempo segurando pra abrir "quem curtiu"

export default function PostCard({ post, usuarioAtual }) {
  const [autor, setAutor] = useState(null);
  // Começa já com a URL original (não a cacheada) — assim a foto aparece
  // na hora via rede/navegador, em vez de ficar em branco "esperando" o
  // cache local resolver. Quando getCachedImageURL terminar, troca pela
  // versão local (blob:), sem nenhum espaço vazio no meio.
  const [midiaURL, setMidiaURL] = useState(post.midiaURL || '');
  // CORREÇÃO (Relatório 1, item 2): a thumbnail (midiaThumbURL) já é gerada
  // e sobe pro Storage há tempo, mas nenhuma tela chegava a exibi-la — o
  // cartão do Feed sempre baixava a foto em tamanho cheio (~1MB), mesmo
  // sendo só uma miniatura na lista. Agora o cartão mostra midiaThumbURL
  // (cai pra midiaURL cheia se não existir — posts antigos, ou se o upload
  // da thumbnail falhar) e só a tela cheia (ImageViewerModal, abaixo)
  // continua usando a foto original.
  const [midiaListaURL, setMidiaListaURL] = useState(post.midiaThumbURL || post.midiaURL || '');
  const [mostrarComentarios, setMostrarComentarios] = useState(false);
  const [imagemAberta, setImagemAberta] = useState(false);
  const [coracaoAnimado, setCoracaoAnimado] = useState(false);
  const [mostrarCurtidas, setMostrarCurtidas] = useState(false);
  const [editandoAberto, setEditandoAberto] = useState(false);
  const [alternandoOculto, setAlternandoOculto] = useState(false);
  const [denunciando, setDenunciando] = useState(false);
  const [denunciado, setDenunciado] = useState(false);
  // Hierarquia visual de post de missão (foto > áudio > demais campos, na
  // ordem definida na missão) — só o primeiro item aparece de cara, o
  // resto fica atrás de "Ver mais" pra não abarrotar o feed.
  const [mostrarTudo, setMostrarTudo] = useState(false);

  const ultimoTapRef = useRef(0);
  const timeoutTapRef = useRef(null);
  const pressTimerRef = useRef(null);
  const longPressAtivoRef = useRef(false);

  const jaCurtiu = post.curtidas?.includes(usuarioAtual?.uid);
  const ehDono = usuarioAtual?.uid === post.autorId;
  const ehAdmin = usuarioAtual?.isAdmin;

  // 2º — curtir na hora, sem esperar o Firestore confirmar (base já
  // existente em lib/useAcaoOtimista.js — ver comentário do hook).
  const [jaCurtiuExibido, dispararCurtida, curtindo] = useAcaoOtimista(jaCurtiu);
  // Item 17 do Bloco 9 — debounce simples pra ignorar duplo toque rápido.
  const emDebounceCurtida = useProtecaoCliqueDuplo();
  const contagemCurtidasBase = post.curtidas?.length || 0;
  const contagemCurtidasExibida =
    contagemCurtidasBase + (jaCurtiuExibido === jaCurtiu ? 0 : jaCurtiuExibido ? 1 : -1);

  useEffect(() => {
    getUsuarioCache(post.autorId).then(setAutor);
  }, [post.autorId]);

  useEffect(() => {
    if (!post.midiaURL) return undefined;
    let cancelado = false;
    // A tela já mostra post.midiaURL (via useState acima) enquanto isso
    // roda em segundo plano — aqui só troca pela versão em cache quando
    // ela ficar pronta, sem nunca deixar a foto sumir da tela.
    getCachedImageURL(post.midiaURL).then((url) => {
      if (!cancelado) setMidiaURL(url);
    });
    return () => {
      cancelado = true;
    };
  }, [post.midiaURL]);

  useEffect(() => {
    const urlThumb = post.midiaThumbURL || post.midiaURL;
    if (!urlThumb) return undefined;
    let cancelado = false;
    getCachedImageURL(urlThumb).then((url) => {
      if (!cancelado) setMidiaListaURL(url);
    });
    return () => {
      cancelado = true;
    };
  }, [post.midiaThumbURL, post.midiaURL]);

  // Limpa timers pendentes se o card sair da tela no meio de um toque
  useEffect(() => {
    return () => {
      if (timeoutTapRef.current) clearTimeout(timeoutTapRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    };
  }, []);

  async function handleLike() {
    if (!usuarioAtual || curtindo || emDebounceCurtida()) return;
    try {
      await dispararCurtida(!jaCurtiuExibido, async () => {
        if (estaOffline()) {
          // Item 16 do Bloco 8 — sem internet: guarda a ação e não tenta
          // falar com o Firestore agora. A tela já mudou (otimista) e não
          // é desfeita — a curtida "de verdade" acontece quando a fila for
          // reprocessada, assim que a conexão voltar.
          enfileirarAcaoOffline('curtidaPost', {
            postId: post.id,
            uid: usuarioAtual.uid,
            jaCurtiu,
            contexto: {
              postAutorId: post.autorId,
              remetente: {
                uid: usuarioAtual.uid,
                nome: usuarioAtual.nome,
                fotoURL: usuarioAtual.fotoURL,
                username: usuarioAtual.username,
              },
            },
          });
          return;
        }
        await toggleLike(post.id, usuarioAtual.uid, jaCurtiu, {
          postAutorId: post.autorId,
          remetente: usuarioAtual,
        });
      });
    } catch (err) {
      console.error('Erro ao curtir/descurtir post:', err);
    }
  }

  // Item 19 — duplo toque curte (nunca descurte) e mostra a animação do coração
  function dispararCurtidaComAnimacao() {
    if (!jaCurtiuExibido) handleLike();
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

  // Correção: editar deixou de mexer só em `texto` direto aqui (o que
  // permitia editar o TÍTULO da missão por engano — ver comentário no topo
  // de EditarPostModal.js) e virou um modal à parte, que edita tudo que é
  // do post (foto, áudio, texto, checks), menos o título da missão.
  const podeEditarPost = ehDono && postAindaEditavel(post.createdAt);
  function handleAbrirEdicao() {
    if (!podeEditarPost) return;
    setEditandoAberto(true);
  }

  // Botão "Ocultar"/"Reexibir" — o dono só ocultar os próprios posts; o
  // Admin pode ocultar qualquer post. Sem limite de 24h (ver firestore.rules).
  async function handleAlternarOcultar() {
    if (alternandoOculto || !usuarioAtual) return;
    setAlternandoOculto(true);
    try {
      await alternarOcultarPost(post.id, !post.oculto, usuarioAtual.uid);
    } catch (err) {
      console.error('Erro ao ocultar/reexibir post:', err);
    } finally {
      setAlternandoOculto(false);
    }
  }

  // Item 17 — Reportar post (visível pra qualquer pessoa logada, exceto o dono)
  async function handleReportar() {
    if (denunciando || denunciado || !usuarioAtual) return;
    const motivo = window.prompt('Por que você está denunciando este post? (opcional)');
    if (motivo === null) return; // cancelou
    setDenunciando(true);
    try {
      await createReport({
        tipo: 'post',
        postId: post.id,
        conteudoAutorId: post.autorId,
        conteudoTexto: post.texto || '',
        motivo,
        reportador: usuarioAtual,
      });
      setDenunciado(true);
    } catch (err) {
      console.error('Erro ao denunciar post:', err);
    } finally {
      setDenunciando(false);
    }
  }

  // Renderiza um item da hierarquia de um post de missão (foto, áudio, ou
  // um campo de resposta). `comDuploToque` só é passado pro primeiro item
  // visível — os que aparecem depois de "Ver mais" não disputam o gesto de
  // duplo toque com o resto da tela.
  function renderItemMissao(item, key, comDuploToque) {
    if (item.tipo === 'foto') {
      const url = item.url === post.midiaURL ? midiaURL : item.url;
      return (
        <button
          key={key}
          onClick={comDuploToque ? handleTapNaFoto : () => setImagemAberta(true)}
          className="relative mb-2.5 block w-full overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Foto da missão" className="w-full object-cover max-h-80" />
          {comDuploToque && coracaoAnimado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={72} className="animate-curtidaPop text-white drop-shadow-lg" fill="currentColor" />
            </span>
          )}
        </button>
      );
    }

    if (item.tipo === 'audio') {
      return (
        <div
          key={key}
          onClick={comDuploToque ? handleTapNoTexto : undefined}
          className="relative mb-2.5 rounded-xl border border-coffee-100 bg-cream px-3 pb-3 pt-4"
        >
          {comDuploToque && (
            <p className="pointer-events-none mb-2 text-center text-[11px] text-coffee-300">
              toque duas vezes para curtir
            </p>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <audio controls src={item.url} className="w-full" />
          </div>
          {comDuploToque && coracaoAnimado && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <Heart size={56} className="animate-curtidaPop text-red-500 drop-shadow-lg" fill="currentColor" />
            </span>
          )}
        </div>
      );
    }

    if (item.tipo === 'check') {
      return (
        <div
          key={key}
          className="mb-2.5 flex items-center gap-2 rounded-xl bg-green-50 px-3.5 py-2.5 text-sm text-green-800"
        >
          <CheckCircle2 size={16} className="flex-shrink-0 text-green-600" />
          <span>{item.label}</span>
        </div>
      );
    }

    if (item.tipo === 'link') {
      return (
        <a
          key={key}
          href={item.valor}
          target="_blank"
          rel="noreferrer"
          className="mb-2.5 flex items-center gap-2 rounded-xl border border-coffee-100 bg-cream px-3.5 py-2.5 text-sm text-coffee-700"
        >
          <Link2 size={15} className="flex-shrink-0 text-coffee-400" />
          <span className="truncate">{item.label || item.valor}</span>
        </a>
      );
    }

    // texto-curto / texto-longo
    return (
      <div key={key} className="mb-2.5 rounded-xl border border-coffee-100 bg-cream px-3.5 py-2.5">
        {item.label && <p className="mb-0.5 text-[11px] font-medium text-coffee-400">{item.label}</p>}
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-coffee-700">{item.valor}</p>
      </div>
    );
  }

  const itensMissao = Array.isArray(post.itens) ? post.itens : null;
  const ehPostDeMissao = !!post.origemMissaoId;
  const temMaisItens = itensMissao && itensMissao.length > 1;
  const itensVisiveis = itensMissao ? (mostrarTudo ? itensMissao : itensMissao.slice(0, 1)) : null;

  // Botão "Ocultar" — o dono só oculta os próprios posts; o Admin oculta
  // qualquer post, mas nunca fica oculto PRA ELE MESMO (sempre vê o
  // conteúdo completo). Pra quem não é dono nem Admin, o post nem chega a
  // aparecer no Feed/Perfil (filtrado antes, ver app/(app)/feed/page.js e
  // ProfileView.js) — este placeholder só cobre o caso de alguém abrir um
  // link direto pra um post oculto de outra pessoa.
  if (post.oculto && !ehAdmin) {
    return (
      <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
        <p className="text-sm italic text-coffee-400">Esse post foi ocultado</p>
        {ehDono && (
          <button
            onClick={handleAlternarOcultar}
            disabled={alternandoOculto}
            className="mt-3 flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600 disabled:opacity-50"
          >
            <Eye size={13} /> Reexibir
          </button>
        )}
      </div>
    );
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
        {post.oculto && ehAdmin && (
          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-medium text-red-600">
            Oculto
          </span>
        )}
        {(ehDono || ehAdmin) && (
          <button
            onClick={handleAlternarOcultar}
            disabled={alternandoOculto}
            className="text-coffee-200 hover:text-coffee-600 disabled:opacity-50"
            aria-label={post.oculto ? 'Reexibir post' : 'Ocultar post'}
          >
            {post.oculto ? <Eye size={15} /> : <EyeOff size={15} />}
          </button>
        )}
        {podeEditarPost && (
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

      {/* Texto — post manual mostra a legenda normal; post de missão mostra
          o TÍTULO da missão, sempre travado (nunca editável, ver
          EditarPostModal.js) e com mais contraste/destaque que o resto do
          post, já que é o título, não um item de resposta qualquer. */}
      {post.texto && (
        <div onClick={itensMissao ? undefined : handleTapNoTexto} className="relative">
          {ehPostDeMissao ? (
            <p className="mb-3 font-destaque text-base font-bold text-coffee-900">{post.texto}</p>
          ) : (
            <TextoComLinks
              texto={post.texto}
              className="mb-3 text-sm leading-relaxed text-coffee-700"
            />
          )}
        </div>
      )}

      {/* Post de missão — hierarquia foto > áudio > demais campos, na ordem
          definida na missão. Só o primeiro item some de cara, o resto fica
          atrás de "Ver mais" pra não abarrotar o feed. */}
      {itensVisiveis && (
        <div className="mb-1">
          {itensVisiveis.map((item, i) => renderItemMissao(item, i, i === 0))}

          {temMaisItens && (
            <button
              onClick={() => setMostrarTudo((v) => !v)}
              className="mb-2 flex items-center gap-1 text-xs font-semibold text-coffee-500"
            >
              {mostrarTudo ? (
                <>
                  Ver menos <ChevronUp size={14} />
                </>
              ) : (
                <>
                  Ver mais <ChevronDown size={14} />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Post manual (fora do fluxo de missões) — foto/áudio simples, como antes */}
      {!itensMissao && post.tipo === 'foto' && midiaURL && (
        <button
          onClick={handleTapNaFoto}
          className="relative mb-3 block w-full overflow-hidden rounded-xl"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={midiaListaURL}
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

      {/* Áudio manual — os controles nativos (play, barra) ocupam todo o
          espaço clicável deles, então o duplo toque não pode ficar "em
          cima" do áudio (senão nunca sobra clique pra reconhecer o gesto,
          e ainda atrapalha o play/pause). Por isso criamos um cartão ao
          redor do player, com uma faixa de toque própria (acima) livre pra
          curtir. */}
      {!itensMissao && post.tipo === 'audio' && post.midiaURL && (
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
            jaCurtiuExibido ? 'text-red-500' : 'text-coffee-300 hover:text-red-400'
          }`}
        >
          <Heart size={17} fill={jaCurtiuExibido ? 'currentColor' : 'none'} />
          {contagemCurtidasExibida}
        </button>

        <button
          onClick={() => setMostrarComentarios((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium text-coffee-300 hover:text-coffee-600"
        >
          <MessageCircle size={17} />
          {post.comentariosCount || 0}
        </button>

        {!ehDono && usuarioAtual && (
          <button
            onClick={handleReportar}
            disabled={denunciando || denunciado}
            aria-label="Denunciar post"
            className={`ml-auto flex items-center gap-1 text-xs font-medium disabled:opacity-60 ${
              denunciado ? 'text-coffee-400' : 'text-coffee-200 hover:text-red-500'
            }`}
          >
            <Flag size={14} fill={denunciado ? 'currentColor' : 'none'} />
            {denunciado ? 'Denunciado' : ''}
          </button>
        )}
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

      {editandoAberto && <EditarPostModal post={post} onFechar={() => setEditandoAberto(false)} />}
    </div>
  );
}
