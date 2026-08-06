'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HandHeart, Check, Clock } from 'lucide-react';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { registerPrayerInteraction, markPrayerAsDone, jaOrouHoje } from '@/lib/firestore-helpers';
import { pontuarOracao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { formatDateBR, isPastDeadline } from '@/lib/dateUtils';
import { useAcaoOtimista } from '@/lib/useAcaoOtimista';
import { estaOffline } from '@/lib/connectivity';
import { enfileirarAcaoOffline } from '@/lib/offlineQueue';

export default function PrayerCard({ pedido }) {
  const { perfil } = useAuth();
  // BUG CORRIGIDO — antes o valor de servidor era fixo em `false`, então
  // sair da tela de Oração e voltar (remonta o componente, perde o estado)
  // fazia o botão "esquecer" que a pessoa já tinha orado hoje. Agora, ao
  // montar, checamos de verdade (jaOrouHoje) se já existe o registro de
  // hoje pra esse pedido+pessoa, e usamos isso como valor real de servidor
  // do hook otimista — assim o botão mostra o estado certo mesmo depois de
  // sair e voltar da tela, e um clique depois de já ter orado não faz mais
  // nada (não desconta ponto nem contador, porque nunca chega a rodar de
  // novo: o botão já nasce desabilitado como "Orou hoje").
  const [jaOrouServidor, setJaOrouServidor] = useState(null); // null = checando ainda
  const [jaOrouExibido, dispararOracao, orando] = useAcaoOtimista(jaOrouServidor === true);
  const [marcandoFeito, setMarcandoFeito] = useState(false);

  useEffect(() => {
    let cancelado = false;
    if (perfil?.uid && pedido?.id) {
      jaOrouHoje(pedido.id, perfil.uid).then((resultado) => {
        if (!cancelado) setJaOrouServidor(resultado);
      });
    }
    return () => {
      cancelado = true;
    };
  }, [pedido?.id, perfil?.uid]);

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
    if (orando || jaOrouExibido || jaOrouServidor === null) return;
    try {
      await dispararOracao(true, async () => {
        if (estaOffline()) {
          // Item 16 do Bloco 8 — sem internet: guarda a ação, mantém a
          // tela como "Orou hoje" (otimista) e não tenta o Firestore agora.
          enfileirarAcaoOffline('oracao', {
            prayerId: pedido.id,
            uid: perfil.uid,
            streakAtual: perfil.streakAtual || 0,
          });
          return;
        }
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

      <div className="mt-3 flex items-end justify-between gap-2">
        {/* Info empilhada: data em cima, contador de orações embaixo */}
        <div className="flex flex-col gap-0.5 text-xs text-coffee-300">
          {cumprido ? (
            <span className="flex items-center gap-1 font-medium text-green-700">
              <Check size={13} /> Atendido
            </span>
          ) : (
            <span className={`flex items-center gap-1 ${vencido ? 'text-coffee-300' : ''}`}>
              <Clock size={13} /> até {formatDateBR(`${pedido.prazo}T00:00:00`)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <HandHeart size={12} className="text-coffee-300" />
            {pedido.totalOracoes || 0} orações
          </span>
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
              disabled={orando || jaOrouExibido || jaOrouServidor === null}
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
