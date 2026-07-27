'use client';

import { useEffect, useState } from 'react';
import { Mailbox, Circle } from 'lucide-react';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToMailbox, markMailAsRead } from '@/lib/firestore-helpers';
import { formatDateTimeBR } from '@/lib/dateUtils';

export default function CorreioPage() {
  const { perfil } = useAuth();
  const [mensagens, setMensagens] = useState(null);

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
            descricao="Mensagens e desafios enviados pela liderança aparecem aqui."
          />
        )}

        <div className="space-y-2.5 pb-6">
          {mensagens?.map((msg) => (
            <button
              key={msg.id}
              onClick={() => abrirMensagem(msg)}
              className="flex w-full items-start gap-3 rounded-xl2 border border-coffee-100 bg-cream-card p-4 text-left shadow-card"
            >
              {!msg.lida && (
                <Circle size={8} fill="currentColor" className="mt-1.5 flex-shrink-0 text-gold" />
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={`whitespace-pre-wrap text-sm ${
                    msg.lida ? 'text-coffee-600' : 'font-semibold text-coffee-800'
                  }`}
                >
                  {msg.texto}
                </p>
                <p className="mt-1.5 text-[11px] text-coffee-300">
                  {msg.createdAt ? formatDateTimeBR(msg.createdAt) : 'agora'}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
