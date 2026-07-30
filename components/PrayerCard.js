'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HandHeart, Check, Clock } from 'lucide-react';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { registerPrayerInteraction, markPrayerAsDone } from '@/lib/firestore-helpers';
import { pontuarOracao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { formatDateBR, isPastDeadline } from '@/lib/dateUtils';
import { useAcaoOtimista } from '@/lib/useAcaoOtimista';

export default function PrayerCard({ pedido }) {
  const { perfil } = useAuth();
  // 4º — "Orei por isso" na hora. Não existe um campo do servidor que diga
  // "esta pessoa já orou hoje" (só a subcoleção de interações, que não é
  // lida aqui), então usamos o hook com valor de servidor fixo em `false`:
  // ele muda pra `true` na hora do toque e nunca é sobreposto de volta —
  // exatamente o comportamento de sessão que a tela já tinha, só que sem
  // esperar o Firestore confirmar antes de mudar o botão.
  const [jaOrouExibido, dispararOracao, orando] = useAcaoOtimista(false);
  const [marcandoFeito, setMarcandoFeito] = useState(false);

  // CORREÇÃO DE BUG: nome/foto sempre atuais em vez do dado congelado.
  const autor = useUsuarioAtual(pedido.autorId, {
    nome: pedido.autorNome,
    fotoURL: pedido.autorFoto,
    username: pedido.autorUsername,
  });

  const vencido = isPastDeadline(pedido.prazo);
  const ehAutor = pedido.autorId === perfil?.uid;
  const cumprido = pedido.status === 'cumprido';

  async function handleOrar() {
    if (orando || jaOrouExibido) return;
    try {
      await dispararOracao(true, async () => {
        const registrou = await registerPrayerInteraction(pedido.id, perfil.uid);
        if (registrou) {
          await pontuarOracao(perfil.uid, pedido.id);
          await verificarConquistas(perfil.uid, perfil.streakAtual || 0, 'oracao');
        }
        // Se `registrou` for false, a pessoa já tinha orado hoje — trata
        // igual visualmente (fica marcado como "Orou hoje" de qualquer jeito).
      });
    } catch (err) {
      console.error('Erro ao registrar oração:', err);
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
        <Link href={`/u/${autor.username}`}>
          <Avatar src={autor.fotoURL} nome={autor.nome} tamanho="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${autor.username}`} className="text-sm font-semibold text-coffee-800">
            {autor.nome}
          </Link>
          <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-coffee-600">
            <TextoComLinks texto={pedido.descricao} />
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
              disabled={orando || jaOrouExibido}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                jaOrouExibido
                  ? 'bg-coffee-100 text-coffee-400'
                  : 'bg-coffee-700 text-cream'
              }`}
            >
              <HandHeart size={13} />
              {jaOrouExibido ? 'Orou hoje' : 'Orei por isso'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
