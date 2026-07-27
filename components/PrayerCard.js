'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HandHeart, Check, Clock } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { registerPrayerInteraction, markPrayerAsDone } from '@/lib/firestore-helpers';
import { pontuarOracao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { formatDateBR, isPastDeadline } from '@/lib/dateUtils';

export default function PrayerCard({ pedido }) {
  const { perfil } = useAuth();
  const [orando, setOrando] = useState(false);
  const [jaOrouAgora, setJaOrouAgora] = useState(false);
  const [marcandoFeito, setMarcandoFeito] = useState(false);

  const vencido = isPastDeadline(pedido.prazo);
  const ehAutor = pedido.autorId === perfil?.uid;
  const cumprido = pedido.status === 'cumprido';

  async function handleOrar() {
    if (orando || jaOrouAgora) return;
    setOrando(true);
    try {
      const registrou = await registerPrayerInteraction(pedido.id, perfil.uid);
      if (registrou) {
        setJaOrouAgora(true);
        await pontuarOracao(perfil.uid, pedido.id);
        await verificarConquistas(perfil.uid, perfil.streakAtual || 0, 'oracao');
      } else {
        setJaOrouAgora(true); // já tinha orado hoje — trata igual visualmente
      }
    } catch (err) {
      console.error('Erro ao registrar oração:', err);
    } finally {
      setOrando(false);
    }
  }

  async function handleMarcarCumprido() {
    if (marcandoFeito) return;
    setMarcandoFeito(true);
    try {
      await markPrayerAsDone(pedido.id);
    } catch (err) {
      console.error('Erro ao marcar pedido como cumprido:', err);
    } finally {
      setMarcandoFeito(false);
    }
  }

  return (
    <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <Link href={`/u/${pedido.autorUsername}`}>
          <Avatar src={pedido.autorFoto} nome={pedido.autorNome} tamanho="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${pedido.autorUsername}`} className="text-sm font-semibold text-coffee-800">
            {pedido.autorNome}
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-coffee-600">
            {pedido.descricao}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-coffee-300">
          {cumprido ? (
            <span className="flex items-center gap-1 font-medium text-green-700">
              <Check size={13} /> Atendido
            </span>
          ) : (
            <span className={`flex items-center gap-1 ${vencido ? 'text-coffee-300' : ''}`}>
              <Clock size={13} /> até {formatDateBR(`${pedido.prazo}T00:00:00`)}
            </span>
          )}
          <span>· {pedido.totalOracoes || 0} orações</span>
        </div>

        <div className="flex items-center gap-2">
          {ehAutor && !cumprido && (
            <button
              onClick={handleMarcarCumprido}
              disabled={marcandoFeito}
              className="rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-600"
            >
              Marcar cumprido
            </button>
          )}
          {!cumprido && (
            <button
              onClick={handleOrar}
              disabled={orando || jaOrouAgora}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                jaOrouAgora
                  ? 'bg-coffee-100 text-coffee-400'
                  : 'bg-coffee-700 text-cream'
              }`}
            >
              <HandHeart size={13} />
              {jaOrouAgora ? 'Orou hoje' : 'Orei por isso'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
