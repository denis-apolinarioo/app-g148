'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Mailbox,
  Circle,
  Heart,
  MessageCircle,
  Pin,
  X,
  Trash2,
  Loader2,
  Trophy,
  ListChecks,
  Sparkles,
  Gift,
  Coins,
  ChevronRight,
} from 'lucide-react';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/EmptyState';
import Avatar from '@/components/Avatar';
import DracmaIcon from '@/components/DracmaIcon';
import ImageViewerModal from '@/components/ImageViewerModal';
import { useAuth } from '@/components/AuthProvider';
import {
  subscribeToMailbox,
  markMailAsRead,
  deleteMailMessage,
  limparMailboxNaoFixadas,
} from '@/lib/firestore-helpers';
import { getCachedImageURL } from '@/lib/imageCache';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { useAcaoOtimista } from '@/lib/useAcaoOtimista';
import { resgatarRecompensaCorreio } from '@/lib/notificacoes';
import { formatarDracma } from '@/lib/dracma';

const QUANTIDADE_BASE_VISIVEL = 20;
const QUANTIDADE_INCREMENTO_VISIVEL = 20;
// Item 15º do Bloco 7 — a partir de quantos pixels de arrasto uma notificação
// é considerada "fechada" (senão, volta pro lugar).
const LIMIAR_ARRASTO_FECHAR = 80;

export default function CorreioPage() {
  const { perfil } = useAuth();
  const [mensagens, setMensagens] = useState(null);
  const [fotoAberta, setFotoAberta] = useState('');
  const [mensagemTelaCheia, setMensagemTelaCheia] = useState(null);
  const [qtdVisivel, setQtdVisivel] = useState(QUANTIDADE_BASE_VISIVEL);
  // Item 15º — fechar some da tela na hora, mesmo antes do Firestore
  // confirmar a exclusão (mesma base otimista já usada no resto do Correio).
  const [escondidos, setEscondidos] = useState(() => new Set());
  // Botão "Limpar tudo" — apaga todas as mensagens não fixadas de uma vez.
  const [limpando, setLimpando] = useState(false);
  // CORREÇÃO: antes usava window.confirm(), que em alguns navegadores/PWA
  // instalado na tela inicial não abre diálogo nenhum (o clique parecia não
  // fazer nada). Agora usa um modal de confirmação próprio do app, igual ao
  // resto da interface, e sempre visível.
  const [confirmandoLimpeza, setConfirmandoLimpeza] = useState(false);
  const [erroLimpeza, setErroLimpeza] = useState('');

  useEffect(() => {
    if (!perfil) return undefined;
    const unsub = subscribeToMailbox(perfil.uid, setMensagens);
    return () => unsub();
  }, [perfil]);

  function fecharMensagem(msg) {
    setEscondidos((atual) => new Set(atual).add(msg.id));
    deleteMailMessage(msg.id).catch((err) => {
      console.error('Erro ao fechar mensagem:', err);
      // Reverte: se apagar falhou (ex.: sem internet), a mensagem volta a aparecer.
      setEscondidos((atual) => {
        const novo = new Set(atual);
        novo.delete(msg.id);
        return novo;
      });
    });
  }

  const visiveis = mensagens?.filter((m) => !escondidos.has(m.id)) || [];
  const fixadas = visiveis.filter((m) => m.fixada);
  const todasNormais = visiveis.filter((m) => !m.fixada);
  // Item 21º — só exibição paginada. A escuta em tempo real já traz todo o
  // histórico da pessoa (subscribeToMailbox não usa orderBy, pra não
  // depender de índice composto), e como isso cresce por pessoa — bem mais
  // devagar que o Feed geral — não precisa limitar a consulta em si, só
  // controlar quanto aparece na tela de uma vez.
  const normais = todasNormais.slice(0, qtdVisivel);
  const temMaisNormais = todasNormais.length > qtdVisivel;

  // "Limpar tudo" — some da tela na hora (mesma base otimista do resto do
  // Correio) e apaga em lote no Firestore. As fixadas nunca entram na lista
  // (só saem quando o Admin apaga, via histórico do Correio no Admin).
  async function limparTudo() {
    if (limpando || todasNormais.length === 0) return;
    const ids = todasNormais.map((m) => m.id);
    setLimpando(true);
    setErroLimpeza('');
    setEscondidos((atual) => {
      const novo = new Set(atual);
      ids.forEach((id) => novo.add(id));
      return novo;
    });
    try {
      await limparMailboxNaoFixadas(ids);
      setConfirmandoLimpeza(false);
    } catch (err) {
      console.error('Erro ao limpar o Correio:', err);
      setEscondidos((atual) => {
        const novo = new Set(atual);
        ids.forEach((id) => novo.delete(id));
        return novo;
      });
      // CORREÇÃO: antes o erro só ia pro console — a pessoa via o botão
      // "não fazer nada" sem entender por quê. Agora mostra a mensagem
      // dentro do próprio modal de confirmação.
      setErroLimpeza('Não foi possível limpar o Correio agora. Confira sua internet e tente de novo.');
    } finally {
      setLimpando(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar
        titulo="Correio"
        voltarPara="/feed"
        acao={
          todasNormais.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setErroLimpeza('');
                setConfirmandoLimpeza(true);
              }}
              aria-label="Limpar tudo"
              className="flex flex-shrink-0 items-center gap-1.5 rounded-full border border-coffee-200 px-2.5 py-1.5 text-xs font-medium text-coffee-500"
            >
              <Trash2 size={13} /> Limpar tudo
            </button>
          )
        }
      />

      <div className="px-4 py-4">
        {mensagens === null && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        )}

        {mensagens?.length === 0 && (
          <EmptyState
            icone={Mailbox}
            titulo="Caixa vazia"
            descricao="Mensagens e notificações aparecem aqui."
          />
        )}

        {/* Item 34 — mensagens do Admin fixadas no topo, com destaque visual */}
        {fixadas.length > 0 && (
          <div className="mb-3 space-y-2.5">
            {fixadas.map((msg) => (
              <LinhaMensagem
                key={msg.id}
                msg={msg}
                onVerFoto={setFotoAberta}
                onAbrirTelaCheia={setMensagemTelaCheia}
                onFechar={fecharMensagem}
              />
            ))}
          </div>
        )}

        <div className="space-y-2.5 pb-6">
          {normais.map((msg) => (
            <LinhaMensagem
              key={msg.id}
              msg={msg}
              onVerFoto={setFotoAberta}
              onAbrirTelaCheia={setMensagemTelaCheia}
              onFechar={fecharMensagem}
            />
          ))}

          {temMaisNormais && (
            <button
              type="button"
              onClick={() => setQtdVisivel((q) => q + QUANTIDADE_INCREMENTO_VISIVEL)}
              className="w-full rounded-xl2 border border-coffee-100 bg-cream-card py-3 text-sm font-semibold text-coffee-600"
            >
              Carregar mais
            </button>
          )}
        </div>
      </div>

      {fotoAberta && (
        <ImageViewerModal src={fotoAberta} alt="Foto da mensagem" onClose={() => setFotoAberta('')} />
      )}

      {mensagemTelaCheia && (
        <MensagemTelaCheiaModal
          msg={mensagemTelaCheia}
          onClose={() => setMensagemTelaCheia(null)}
          onVerFoto={setFotoAberta}
        />
      )}

      {confirmandoLimpeza && (
        <ConfirmarLimparTudoModal
          quantidade={todasNormais.length}
          limpando={limpando}
          erro={erroLimpeza}
          onCancelar={() => {
            if (limpando) return;
            setConfirmandoLimpeza(false);
            setErroLimpeza('');
          }}
          onConfirmar={limparTudo}
        />
      )}
    </div>
  );
}

// Modal de confirmação do "Limpar tudo" — substitui o window.confirm() de
// antes (não confiável em todo navegador/PWA instalado) por um componente
// próprio, no mesmo padrão visual dos outros modais do app.
function ConfirmarLimparTudoModal({ quantidade, limpando, erro, onCancelar, onConfirmar }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onCancelar}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50">
          <Trash2 size={20} className="text-red-600" />
        </div>
        <p className="mt-3 text-center font-destaque text-base font-semibold text-coffee-800">
          Limpar o Correio?
        </p>
        <p className="mt-1 text-center text-sm text-coffee-400">
          {quantidade === 1
            ? '1 mensagem será apagada.'
            : `${quantidade} mensagens serão apagadas.`}{' '}
          As mensagens fixadas não serão apagadas.
        </p>

        {erro && <p className="mt-3 text-center text-xs text-red-600">{erro}</p>}

        <button
          type="button"
          onClick={onConfirmar}
          disabled={limpando}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-60"
        >
          {limpando && <Loader2 size={15} className="animate-spin" />}
          {limpando ? 'Apagando...' : 'Apagar tudo'}
        </button>
        <button
          type="button"
          onClick={onCancelar}
          disabled={limpando}
          className="mt-2 w-full text-center text-xs text-coffee-400 disabled:opacity-60"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Item novo — tipos "de sistema" (não são mais uma interação social de
// outra pessoa, e sim um aviso automático sobre você mesmo: conquista,
// missão nova, ganho de pontos/dracma pelo Admin). Cada um tem ícone e
// destino de clique próprios (ver ICONE_SISTEMA e handleClique abaixo).
const TIPOS_SISTEMA = ['conquista', 'missao_nova', 'missao_especial', 'pontos_admin', 'dracma_admin'];
const ICONE_SISTEMA = {
  conquista: Trophy,
  missao_nova: ListChecks,
  missao_especial: Sparkles,
  pontos_admin: Coins,
  dracma_admin: DracmaIcon,
};

/**
 * Item novo — botão "Receber" pra mensagens do Correio com pontos/dracma
 * anexados (ver AbaCorreio.js). Cuida do próprio estado de carregando/erro
 * e nunca deixa clicar duas vezes (o próprio resgatarRecompensaCorreio já é
 * atômico do lado do banco, isso aqui é só pra não deixar a pessoa achar
 * que travou).
 */
function BlocoRecompensaCorreio({ msg }) {
  const { perfil } = useAuth();
  const [estado, setEstado] = useState('idle'); // 'idle' | 'resgatando' | 'erro' | 'feito'

  const jaResgatado = !!msg.resgatado || estado === 'feito';
  const pontos = Number(msg.pontosAnexados) || 0;
  const dracmas = Number(msg.dracmasAnexados) || 0;

  async function handleReceber(e) {
    e.stopPropagation();
    if (jaResgatado || estado === 'resgatando' || !perfil?.uid) return;
    setEstado('resgatando');
    try {
      await resgatarRecompensaCorreio(msg.id, perfil.uid);
      setEstado('feito');
    } catch (err) {
      console.error('Erro ao resgatar recompensa do Correio:', err);
      setEstado('erro');
    }
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`mt-2 flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        jaResgatado ? 'border-coffee-100 bg-cream' : 'border-gold/50 bg-gold/10'
      }`}
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-coffee-700">
        {pontos > 0 && (
          <span className="flex items-center gap-1">
            <Coins size={13} className="text-gold" /> {pontos} pts
          </span>
        )}
        {dracmas > 0 && (
          <span className="flex items-center gap-1">
            <DracmaIcon size={13} className="text-gold" /> {formatarDracma(dracmas)}
          </span>
        )}
      </span>

      {jaResgatado ? (
        <span className="text-xs font-semibold text-coffee-400">Recebido ✓</span>
      ) : (
        <button
          type="button"
          onClick={handleReceber}
          disabled={estado === 'resgatando'}
          className="flex items-center gap-1 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-coffee-900 disabled:opacity-60"
        >
          {estado === 'resgatando' ? <Loader2 size={13} className="animate-spin" /> : <Gift size={13} />}
          Receber
        </button>
      )}

      {estado === 'erro' && (
        <p className="w-full text-[11px] text-red-500">Não deu pra receber agora. Toque de novo.</p>
      )}
    </div>
  );
}

function LinhaMensagem({ msg, onVerFoto, onAbrirTelaCheia, onFechar }) {
  const router = useRouter();
  const TIPOS_NOTIFICACAO = ['curtida', 'comentario', 'curtida_comentario', 'mencao'];
  const ehNotificacao = TIPOS_NOTIFICACAO.includes(msg.tipo);
  const Icone =
    msg.tipo === 'curtida' || msg.tipo === 'curtida_comentario'
      ? Heart
      : msg.tipo === 'comentario' || msg.tipo === 'mencao'
        ? MessageCircle
        : null;
  const ehSistema = TIPOS_SISTEMA.includes(msg.tipo);
  const IconeSistema = ICONE_SISTEMA[msg.tipo] || null;
  const temRecompensa = (Number(msg.pontosAnexados) || 0) > 0 || (Number(msg.dracmasAnexados) || 0) > 0;
  // Item 15º — fixadas não podem ser fechadas/arrastadas.
  const podeFechar = !msg.fixada;

  // 5º — marcar como lida na hora, sem esperar o Firestore confirmar.
  const [lidaExibida, dispararLeitura] = useAcaoOtimista(msg.lida);

  // Item 15º — arrastar horizontalmente pra fechar (além do botão de X).
  const [arrastando, setArrastando] = useState(false);
  const [arrastoX, setArrastoX] = useState(0);
  const [inicioX, setInicioX] = useState(0);

  function marcarComoLida() {
    if (lidaExibida) return;
    dispararLeitura(true, () => markMailAsRead(msg.id)).catch((err) => {
      console.error('Erro ao marcar mensagem como lida:', err);
    });
  }

  // Item 15º — clique leva pro lugar certo: post curtido/comentado, mensagem
  // em tela cheia, ou (via os links de nome/foto abaixo, que já têm
  // stopPropagation) o perfil de quem curtiu/comentou. Item novo — tipos de
  // sistema levam direto pra onde fazem sentido (mesmos destinos usados no
  // push, ver montarUrlDestino em functions/index.js).
  function handleClique() {
    marcarComoLida();
    if (ehNotificacao && msg.postId) {
      router.push(`/post/${msg.postId}`);
    } else if (msg.tipo === 'conquista') {
      router.push(`/perfil?conquista=${encodeURIComponent(msg.achievementId || '')}`);
    } else if (msg.tipo === 'missao_nova' || msg.tipo === 'missao_especial') {
      router.push('/missoes');
    } else if (msg.tipo === 'pontos_admin') {
      router.push('/perfil');
    } else if (msg.tipo === 'dracma_admin') {
      router.push('/carteira');
    } else if (!ehNotificacao) {
      onAbrirTelaCheia(msg);
    }
  }

  function handlePointerDown(e) {
    if (!podeFechar) return;
    setInicioX(e.clientX);
    setArrastando(true);
  }
  function handlePointerMove(e) {
    if (!arrastando) return;
    setArrastoX(e.clientX - inicioX);
  }
  function encerrarArrasto() {
    if (!arrastando) return;
    setArrastando(false);
    if (Math.abs(arrastoX) > LIMIAR_ARRASTO_FECHAR) {
      onFechar(msg);
    } else {
      setArrastoX(0);
    }
  }

  return (
    <div
      onClick={handleClique}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={encerrarArrasto}
      onPointerLeave={encerrarArrasto}
      style={{
        transform: `translateX(${arrastoX}px)`,
        opacity: 1 - Math.min(Math.abs(arrastoX) / 250, 0.7),
        touchAction: podeFechar ? 'pan-y' : 'auto',
      }}
      className={`relative flex w-full items-start gap-3 rounded-xl2 border p-4 shadow-card ${
        arrastando ? '' : 'transition-transform duration-200'
      } ${
        msg.fixada
          ? 'border-2 border-gold bg-gold/15 shadow-md'
          : 'border-coffee-100 bg-cream-card'
      }`}
    >
      {/* CORREÇÃO: antes o pin e a bolinha de "novo" eram mutuamente
          exclusivos (só um dos dois aparecia), então uma mensagem fixada
          E não lida nunca mostrava a bolinha. Agora os dois podem
          aparecer juntos, empilhados nessa coluna estreita. */}
      {(msg.fixada || !lidaExibida) && (
        <div className="mt-1 flex flex-shrink-0 flex-col items-center gap-1">
          {msg.fixada && <Pin size={13} className="text-gold" fill="currentColor" />}
          {!lidaExibida && <Circle size={8} fill="currentColor" className="text-gold" />}
        </div>
      )}

      {/* Item 33/GLOBAL — avatar e nome de quem curtiu/comentou levam ao perfil */}
      {ehNotificacao && (
        <Link
          href={`/u/${msg.remetenteUsername || msg.remetenteId}`}
          className="flex-shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar src={msg.remetenteFoto} nome={msg.remetenteNome || ''} tamanho={32} />
        </Link>
      )}

      {/* Item novo — tipos de sistema ganham um círculo de ícone no lugar
          do avatar, já que não são uma interação de outra pessoa. */}
      {ehSistema && IconeSistema && (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <IconeSistema size={16} />
        </div>
      )}

      <div className="min-w-0 flex-1 pr-5">
        {msg.fixada && (
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-gold">Fixado</p>
        )}
        {ehNotificacao ? (
          <p className="text-sm text-coffee-800">
            <Link
              href={`/u/${msg.remetenteUsername || msg.remetenteId}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {msg.remetenteNome || 'Alguém'}
            </Link>{' '}
            <span className={lidaExibida ? 'text-coffee-600' : 'font-semibold'}>{msg.texto}</span>
          </p>
        ) : ehSistema ? (
          <p className="flex items-center gap-1 text-sm">
            <span className={lidaExibida ? 'text-coffee-600' : 'font-semibold text-coffee-800'}>
              {msg.texto}
            </span>
            <ChevronRight size={14} className="flex-shrink-0 text-coffee-300" />
          </p>
        ) : (
          <p
            className={`whitespace-pre-wrap text-sm ${
              lidaExibida ? 'text-coffee-600' : 'font-semibold text-coffee-800'
            }`}
          >
            {msg.texto}
          </p>
        )}

        {/* Item 35 — foto anexada à mensagem */}
        {msg.fotoURL && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVerFoto(msg.fotoURL);
            }}
            className="mt-2 block overflow-hidden rounded-lg"
          >
            <FotoMensagemCacheada url={msg.fotoURL} thumbUrl={msg.fotoThumbURL} />
          </button>
        )}

        {/* Item novo — recompensa anexada (pontos/dracma), com botão de
            receber. Só aparece em mensagens comuns do Admin que tiverem
            algum valor anexado (ver AbaCorreio.js). */}
        {temRecompensa && <BlocoRecompensaCorreio msg={msg} />}

        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-coffee-300">
          {/* Item 15º — ícones preenchidos em vez de vazados */}
          {Icone && <Icone size={11} fill="currentColor" />}
          {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
        </p>
      </div>

      {/* Item 15º — fechar (além de arrastar), exceto mensagens fixadas */}
      {podeFechar && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onFechar(msg);
          }}
          aria-label="Fechar"
          className="absolute right-2.5 top-2.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:bg-coffee-50 hover:text-coffee-600"
        >
          <X size={13} />
        </button>
      )}
    </div>
  );
}

// Item 15º — "mensagem em tela cheia": abre a mensagem completa (com foto
// grande, se tiver) num modal, ao clicar numa mensagem que não é notificação
// automática de curtida/comentário.
function MensagemTelaCheiaModal({ msg, onClose, onVerFoto }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-cream-card p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          {msg.fixada ? (
            <p className="text-[10px] font-bold uppercase tracking-wide text-gold">Fixado</p>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-400 hover:bg-coffee-50"
          >
            <X size={16} />
          </button>
        </div>

        <p className="whitespace-pre-wrap text-base text-coffee-800">{msg.texto}</p>

        {msg.fotoURL && (
          <button
            type="button"
            onClick={() => onVerFoto(msg.fotoURL)}
            className="mt-3 block overflow-hidden rounded-lg"
          >
            <FotoMensagemCacheada url={msg.fotoURL} thumbUrl={msg.fotoThumbURL} />
          </button>
        )}

        <p className="mt-3 text-xs text-coffee-300">
          {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
        </p>
      </div>
    </div>
  );
}

// Miniatura da foto anexada, passando pelo cache persistente (mesmo padrão
// do Avatar.js) — sem isso, toda vez que o Correio é aberto as fotos
// anexadas baixariam de novo do Firebase Storage.
function FotoMensagemCacheada({ url, thumbUrl }) {
  const [urlLocal, setUrlLocal] = useState('');
  // CORREÇÃO (Relatório 1, item 2): fotoThumbURL já era gerada e enviada,
  // mas nunca chegava a ser usada — a prévia sempre baixava a foto em
  // tamanho cheio. Agora prefere a miniatura (cai pra `url` cheia se não
  // existir, ex.: mensagens antigas).
  const urlParaExibir = thumbUrl || url;

  useEffect(() => {
    let cancelado = false;
    getCachedImageURL(urlParaExibir).then((resolvida) => {
      if (!cancelado) setUrlLocal(resolvida);
    });
    return () => {
      cancelado = true;
    };
  }, [urlParaExibir]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlLocal || urlParaExibir} alt="Foto da mensagem" className="max-h-40 w-full object-cover" />;
}
