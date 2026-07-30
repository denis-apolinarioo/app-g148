'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Mailbox, Circle, Heart, MessageCircle, Pin } from 'lucide-react';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/EmptyState';
import Avatar from '@/components/Avatar';
import ImageViewerModal from '@/components/ImageViewerModal';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToMailbox, markMailAsRead } from '@/lib/firestore-helpers';
import { getCachedImageURL } from '@/lib/imageCache';
import { formatDateTimeBR } from '@/lib/dateUtils';

const QUANTIDADE_BASE_VISIVEL = 20;
const QUANTIDADE_INCREMENTO_VISIVEL = 20;

export default function CorreioPage() {
  const { perfil } = useAuth();
  const [mensagens, setMensagens] = useState(null);
  const [fotoAberta, setFotoAberta] = useState('');
  const [qtdVisivel, setQtdVisivel] = useState(QUANTIDADE_BASE_VISIVEL);

  useEffect(() => {
    if (!perfil) return undefined;
    const unsub = subscribeToMailbox(perfil.uid, setMensagens);
    return () => unsub();
  }, [perfil]);

  async function abrirMensagem(msg) {
    if (!msg.lida) {
      try {
        await markMailAsRead(msg.id);
      } catch (err) {
        console.error('Erro ao marcar mensagem como lida:', err);
      }
    }
  }

  const fixadas = mensagens?.filter((m) => m.fixada) || [];
  const todasNormais = mensagens?.filter((m) => !m.fixada) || [];
  // Item 21º — só exibição paginada. A escuta em tempo real já traz todo o
  // histórico da pessoa (subscribeToMailbox não usa orderBy, pra não
  // depender de índice composto), e como isso cresce por pessoa — bem mais
  // devagar que o Feed geral — não precisa limitar a consulta em si, só
  // controlar quanto aparece na tela de uma vez.
  const normais = todasNormais.slice(0, qtdVisivel);
  const temMaisNormais = todasNormais.length > qtdVisivel;

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Correio" voltarPara="/feed" />

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
              <LinhaMensagem key={msg.id} msg={msg} onAbrir={abrirMensagem} onVerFoto={setFotoAberta} />
            ))}
          </div>
        )}

        <div className="space-y-2.5 pb-6">
          {normais.map((msg) => (
            <LinhaMensagem key={msg.id} msg={msg} onAbrir={abrirMensagem} onVerFoto={setFotoAberta} />
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
    </div>
  );
}

function LinhaMensagem({ msg, onAbrir, onVerFoto }) {
  const ehNotificacao = msg.tipo === 'curtida' || msg.tipo === 'comentario';
  const Icone = msg.tipo === 'curtida' ? Heart : msg.tipo === 'comentario' ? MessageCircle : null;

  return (
    <div
      onClick={() => onAbrir(msg)}
      className={`flex w-full items-start gap-3 rounded-xl2 border p-4 shadow-card ${
        msg.fixada ? 'border-gold/40 bg-gold/10' : 'border-coffee-100 bg-cream-card'
      }`}
    >
      {msg.fixada && <Pin size={13} className="mt-1 flex-shrink-0 text-gold" />}
      {!msg.fixada && !msg.lida && (
        <Circle size={8} fill="currentColor" className="mt-1.5 flex-shrink-0 text-gold" />
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

      <div className="min-w-0 flex-1">
        {ehNotificacao ? (
          <p className="text-sm text-coffee-800">
            <Link
              href={`/u/${msg.remetenteUsername || msg.remetenteId}`}
              className="font-semibold hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {msg.remetenteNome || 'Alguém'}
            </Link>{' '}
            <span className={msg.lida ? 'text-coffee-600' : 'font-semibold'}>{msg.texto}</span>
          </p>
        ) : (
          <p
            className={`whitespace-pre-wrap text-sm ${
              msg.lida ? 'text-coffee-600' : 'font-semibold text-coffee-800'
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
            <FotoMensagemCacheada url={msg.fotoURL} />
          </button>
        )}

        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-coffee-300">
          {Icone && <Icone size={11} />}
          {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
        </p>
      </div>
    </div>
  );
}

// Miniatura da foto anexada, passando pelo cache persistente (mesmo padrão
// do Avatar.js) — sem isso, toda vez que o Correio é aberto as fotos
// anexadas baixariam de novo do Firebase Storage.
function FotoMensagemCacheada({ url }) {
  const [urlLocal, setUrlLocal] = useState('');

  useEffect(() => {
    let cancelado = false;
    getCachedImageURL(url).then((resolvida) => {
      if (!cancelado) setUrlLocal(resolvida);
    });
    return () => {
      cancelado = true;
    };
  }, [url]);

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlLocal || url} alt="Foto da mensagem" className="max-h-40 w-full object-cover" />;
}
