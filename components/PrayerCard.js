'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HandHeart, Check, Clock } from 'lucide-react';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { markPrayerAsDone, jaOrouHoje } from '@/lib/firestore-helpers';
import { pontuarOracao, desfazerPontosOracao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { formatDateBR, isPastDeadline } from '@/lib/dateUtils';
import { useAcaoOtimista } from '@/lib/useAcaoOtimista';
import { estaOffline } from '@/lib/connectivity';
import { enfileirarAcaoOffline } from '@/lib/offlineQueue';

export default function PrayerCard({ pedido }) {
  const { perfil } = useAuth();
  // Estado real de servidor: ao montar, checa (jaOrouHoje) se já existe o
  // registro de hoje pra esse pedido+pessoa, e usa isso como valor real de
  // servidor do hook otimista — assim o botão mostra o estado certo mesmo
  // depois de sair e voltar da tela (antes ficava sempre fixo em "não
  // orou", então voltar pra tela fazia parecer que o clique nunca tinha
  // acontecido). Ver handleOrar abaixo pro comportamento de alternar
  // clique/desclique.
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
    if (orando || jaOrouServidor === null) return;
    // Agora o clique ALTERNA: se ainda não orou hoje, "Orei por isso" registra
    // e pontua; se já orou, clicar de novo é o desclique — desfaz o registro
    // de hoje, tira 1 do contador de orações do pedido e devolve os pontos
    // ganhos (lib/points.js:desfazerPontosOracao). Como o desclique sempre
    // desfaz exatamente o que o clique anterior tinha feito, dá pra alternar
    // várias vezes sem "farmar" oração — no fim só conta o estado em que
    // parou (orou ou não orou hoje), nunca mais de 1.
    const novoValor = !jaOrouExibido;
    try {
      await dispararOracao(novoValor, async () => {
        if (estaOffline()) {
          if (novoValor) {
            // Item 16 do Bloco 8 — sem internet: guarda a ação, mantém a
            // tela como "Orou hoje" (otimista) e não tenta o Firestore agora.
            enfileirarAcaoOffline('oracao', {
              prayerId: pedido.id,
              uid: perfil.uid,
              streakAtual: perfil.streakAtual || 0,
            });
          }
          // Desclique sem internet não é enfileirado (não tem como confirmar
          // com o servidor agora) — a tela muda na hora, mas ao sair e voltar
          // desta tela o botão volta a mostrar o estado real assim que a
          // conexão voltar.
          return;
        }
        if (novoValor) {
          const orou = await pontuarOracao(perfil.uid, pedido.id);
          if (orou) {
            await verificarConquistas(perfil.uid, perfil.streakAtual || 0, 'oracao');
          }
        } else {
          await desfazerPontosOracao(perfil.uid, pedido.id);
        }
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
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
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

        {/* Data/status no canto superior direito */}
        <div className="shrink-0 pt-0.5 text-xs text-coffee-300">
          {cumprido ? (
            <span className="flex items-center gap-1 font-medium text-green-700">
              <Check size={13} /> Atendido
            </span>
          ) : (
            <span className={`flex items-center gap-1 ${vencido ? 'text-coffee-300' : ''}`}>
              <Clock size={13} /> até {formatDateBR(`${pedido.prazo}T00:00:00`)}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        {/* Só a quantidade de orações no canto inferior esquerdo */}
        <span className="flex items-center gap-1 text-xs text-coffee-300">
          <HandHeart size={12} className="text-coffee-300" />
          {pedido.totalOracoes || 0} orações
        </span>

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
              disabled={orando || jaOrouServidor === null}
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
