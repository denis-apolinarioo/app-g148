'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HandHeart, Check, Clock, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import Avatar from '@/components/Avatar';
import TextoComLinks from '@/components/TextoComLinks';
import EditarOracaoModal from '@/components/EditarOracaoModal';
import ConfirmarAcaoModal from '@/components/ConfirmarAcaoModal';
import { useAuth } from '@/components/AuthProvider';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import {
  markPrayerAsDone,
  jaOrouHoje,
  deletePrayer,
  alternarOcultarPrayer,
} from '@/lib/firestore-helpers';
import { pontuarOracao, desfazerPontosOracao } from '@/lib/points';
import { verificarConquistas } from '@/lib/achievements';
import { formatDateBR, isPastDeadline, postAindaEditavel } from '@/lib/dateUtils';
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
  const [editandoAberto, setEditandoAberto] = useState(false);
  const [alternandoOculto, setAlternandoOculto] = useState(false);
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);
  const [apagandoPedido, setApagandoPedido] = useState(false);

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
  const ehAdmin = !!perfil?.isAdmin;
  const cumprido = pedido.status === 'cumprido';
  // Mesma regra de 24h do post (postAindaEditavel, lib/dateUtils.js) — só o
  // dono, e só até 24h depois de criado.
  const podeEditarPedido = ehAutor && postAindaEditavel(pedido.createdAt);

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

  // Botão "Ocultar"/"Reexibir" — o dono só oculta os próprios pedidos; o
  // Admin pode ocultar qualquer um. Sem limite de 24h (mesmo padrão do
  // post, ver alternarOcultarPost em PostCard.js).
  async function handleAlternarOcultar() {
    if (alternandoOculto || !perfil) return;
    setAlternandoOculto(true);
    try {
      await alternarOcultarPrayer(pedido.id, !pedido.oculto, perfil.uid);
    } catch (err) {
      console.error('Erro ao ocultar/reexibir pedido de oração:', err);
    } finally {
      setAlternandoOculto(false);
    }
  }

  // Apagar um pedido de oração. Diferente de apagar um post, isso NUNCA
  // mexe em pontos/contagem de conquista de ninguém — nem do autor, nem de
  // quem já orou por ele. O pedido só some. Quem afeta pontuação é o
  // desclique em "Orou hoje" (handleOrar acima) — apagar o pedido em si
  // não desfaz nenhuma oração já registrada.
  async function handleApagar() {
    if (apagandoPedido) return;
    setApagandoPedido(true);
    try {
      await deletePrayer(pedido.id);
      setConfirmandoExclusao(false);
    } catch (err) {
      console.error('Erro ao apagar pedido de oração:', err);
    } finally {
      setApagandoPedido(false);
    }
  }

  // Mesmo padrão do PostCard.js: pra quem não é dono nem Admin, o pedido
  // oculto nem chega a aparecer na lista de Oração/Perfil (filtrado antes) —
  // este placeholder só cobre quem abrir um link direto pra ele.
  if (pedido.oculto && !ehAdmin) {
    return (
      <div className="rounded-xl2 bg-cream-card p-4 shadow-flutuante">
        <p className="text-sm italic text-coffee-400">Esse pedido foi ocultado</p>
        {ehAutor && (
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
    <div className="rounded-xl2 bg-cream-card p-4 shadow-flutuante">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Link href={`/u/${autor.username || pedido.autorId}`}>
            <Avatar src={autor.fotoURL} nome={autor.nome} tamanho="sm" />
          </Link>
          <div className="min-w-0 flex-1">
            <Link href={`/u/${autor.username || pedido.autorId}`} className="text-sm font-semibold text-coffee-800">
              {autor.nome}
            </Link>
            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-coffee-600">
              <TextoComLinks texto={pedido.descricao} />
            </p>
          </div>
        </div>

        {/* Ícones (ocultar/editar/excluir, mesmo padrão do PostCard.js) +
            data/status, empilhados no canto superior direito */}
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          {(ehAutor || ehAdmin) && (
            <div className="flex items-center gap-2">
              {/* Mesmo padrão do PostCard.js: pro Admin, quando o pedido
                  está oculto, o ícone fica vermelho e ganha o rótulo
                  "Oculto" ao lado — só o Admin vê isso; pra quem não é
                  Admin nem autor, o pedido nem chega a aparecer na lista
                  (ver placeholder "Esse pedido foi ocultado" acima). */}
              {pedido.oculto && ehAdmin && (
                <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-600">
                  Oculto
                </span>
              )}
              <button
                onClick={handleAlternarOcultar}
                disabled={alternandoOculto}
                className={`disabled:opacity-50 ${
                  pedido.oculto ? 'text-red-500 hover:text-red-600' : 'text-coffee-200 hover:text-coffee-600'
                }`}
                aria-label={pedido.oculto ? 'Reexibir pedido' : 'Ocultar pedido'}
              >
                {pedido.oculto ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              {podeEditarPedido && (
                <button
                  onClick={() => setEditandoAberto(true)}
                  className="text-coffee-200 hover:text-coffee-600"
                  aria-label="Editar pedido"
                >
                  <Pencil size={14} />
                </button>
              )}
              <button
                onClick={() => setConfirmandoExclusao(true)}
                className="text-coffee-200 hover:text-red-500"
                aria-label="Apagar pedido"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
          <span className="text-xs text-coffee-300">
            {cumprido ? (
              <span className="flex items-center gap-1 font-medium text-green-700">
                <Check size={13} /> Atendido
              </span>
            ) : (
              <span className={`flex items-center gap-1 ${vencido ? 'text-coffee-300' : ''}`}>
                <Clock size={13} /> até {formatDateBR(`${pedido.prazo}T00:00:00`)}
              </span>
            )}
            {pedido.editadoEm && <span className="mt-0.5 block text-right">· editado</span>}
          </span>
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
                  : 'bg-forte text-texto-forte'
              }`}
            >
              <HandHeart size={13} />
              {jaOrouExibido ? 'Orou hoje' : 'Orei por isso'}
            </button>
          )}
        </div>
      </div>

      {editandoAberto && (
        <EditarOracaoModal pedido={pedido} onFechar={() => setEditandoAberto(false)} />
      )}

      {confirmandoExclusao && (
        <ConfirmarAcaoModal
          titulo="Apagar este pedido?"
          mensagem="Isso não mexe em pontos nem contagem de conquista de ninguém — o pedido só some. Essa ação não pode ser desfeita."
          textoConfirmar="Apagar"
          confirmando={apagandoPedido}
          onFechar={() => setConfirmandoExclusao(false)}
          onConfirmar={handleApagar}
        />
      )}
    </div>
  );
}
