'use client';

import { useEffect, useState } from 'react';
import { ScrollText, Gift, Coins, X } from 'lucide-react';
import { getVersiculoDoDia } from '@/lib/bible';
import { pontuarAberturaVersiculo } from '@/lib/points';
import { todayBrasilia } from '@/lib/dateUtils';
import DracmaIcon from '@/components/DracmaIcon';

/**
 * Verso do dia — em vez de mostrar o texto direto, vira um convite ("Ver o
 * que o Senhor tem a me dizer hoje") ao lado de um pergaminho. Ao tocar no
 * texto OU no pergaminho, ele "desenrola" pra baixo revelando o verso;
 * tocar de novo fecha. Mesmo tema/cores de sempre (coffee-700 + dourado),
 * só ganhou esse novo comportamento.
 *
 * Com o verso aberto, aparece um botão de recompensa (canto direito, ao
 * lado do texto) — ao tocar, resgata a recompensa configurável do dia
 * (pontos e/ou Dracma, o que o Admin tiver habilitado em Ações > "Abrir o
 * Verso do Dia") e mostra um pop-up flutuante com o que foi recebido. Só
 * dá pra resgatar 1 vez por dia (fuso Brasília) — passada a meia-noite,
 * libera de novo pro dia seguinte (ver lib/points.js ->
 * pontuarAberturaVersiculo). `perfil.ultimoVersiculoAbertoEm` já vem em
 * tempo real do AuthProvider, então o botão nasce no estado certo (já
 * resgatado hoje ou não) sem precisar de leitura extra.
 */
export default function VersiculoDiario({ uid, perfil }) {
  const [versiculo, setVersiculo] = useState(null);
  const [aberto, setAberto] = useState(false);
  const [resgatando, setResgatando] = useState(false);
  const [recompensa, setRecompensa] = useState(null); // { pontosGanhos, dracmaGanho, jaRecebidoHoje }

  const jaRecebidoHoje = perfil?.ultimoVersiculoAbertoEm === todayBrasilia();

  useEffect(() => {
    let ativo = true;
    getVersiculoDoDia().then((v) => {
      if (ativo) setVersiculo(v);
    });
    return () => {
      ativo = false;
    };
  }, []);

  function handleAlternar() {
    if (!versiculo) return;
    setAberto((atual) => !atual);
  }

  async function handleResgatar() {
    if (!uid || resgatando) return;
    setResgatando(true);
    try {
      const resultado = await pontuarAberturaVersiculo(uid);
      setRecompensa(resultado);
    } catch (err) {
      console.error('Erro ao resgatar recompensa do Verso do Dia:', err);
    } finally {
      setResgatando(false);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl2 bg-coffee-700 px-6 py-6 shadow-soft">
      <div className="pointer-events-none absolute -right-6 -top-8 font-display text-[7rem] leading-none text-coffee-600/40">
        &rdquo;
      </div>

      <p className="relative text-[11px] font-semibold uppercase tracking-wider text-coffee-200">
        Verso do dia
      </p>

      <button
        type="button"
        onClick={handleAlternar}
        disabled={!versiculo}
        className="relative mt-3 flex w-full items-center gap-3.5 text-left disabled:opacity-70"
      >
        {/* Pergaminho dourado — ícone de diploma/pergaminho, girando
            levemente quando aberto pra reforçar o toque. */}
        <span
          className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-coffee-600/60 shadow-md transition-transform duration-500 ${
            aberto ? 'rotate-6' : '-rotate-3'
          }`}
        >
          <ScrollText className="h-6 w-6 text-gold-soft" strokeWidth={1.8} />
        </span>

        {versiculo ? (
          <span className="font-display text-base italic leading-snug text-cream">
            Ver o que o Senhor tem a me dizer hoje
          </span>
        ) : (
          <span className="flex-1 space-y-2">
            <span className="block h-4 w-full animate-pulse rounded bg-coffee-600/60" />
            <span className="block h-4 w-4/5 animate-pulse rounded bg-coffee-600/60" />
          </span>
        )}
      </button>

      {/* "Desenrola pra baixo": grid-template-rows de 0fr -> 1fr é o jeito
          mais estável de animar até altura automática sem medir nada em
          JS — o conteúdo real fica dentro de um overflow-hidden. O mt-4
          (espaço acima da linha) também entra na transição, senão ele some
          de vez ao fechar e a linha "pula" pra cima de repente. */}
      <div
        className={`relative grid transition-[grid-template-rows,margin-top] duration-500 ease-in-out ${
          aberto ? 'grid-rows-[1fr] mt-4' : 'grid-rows-[0fr] mt-0'
        }`}
      >
        <div className="overflow-hidden">
          {/* A linha (border-t) tem sua própria transição de opacidade,
              mais rápida e sem esperar o "trem" (o bloco todo) terminar de
              recolher — ao fechar ela some quase na hora, antes do resto
              subir; ao abrir ela entra com uma pausa curta (delay-150),
              depois que a caixa já começou a abrir espaço. */}
          <div
            className={`border-t border-coffee-500/50 pt-4 transition-opacity duration-200 ${
              aberto ? 'opacity-100 delay-150' : 'opacity-0'
            }`}
          >
            {/* Texto do verso, com o botão de recompensa embaixo, alinhado
                à direita (antes ficava ao lado do texto, em cima). */}
            <div>
              <p className="font-display text-lg italic leading-relaxed text-cream">{versiculo?.texto}</p>
              <p className="mt-3 text-sm font-medium text-coffee-200">
                {versiculo?.referencia} · {versiculo?.versao || 'NAA'}
              </p>

              {uid && (
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={handleResgatar}
                    disabled={resgatando || jaRecebidoHoje}
                    aria-label={jaRecebidoHoje ? 'Recompensa de hoje já resgatada' : 'Receber recompensa do dia'}
                    className={`flex flex-shrink-0 flex-col items-center gap-1 rounded-xl2 px-3 py-2.5 transition-transform active:scale-95 ${
                      jaRecebidoHoje
                        ? 'bg-coffee-600/30 text-coffee-300'
                        : 'bg-gold-soft/90 text-coffee-900 shadow-md active:bg-gold-soft'
                    } disabled:opacity-70`}
                  >
                    <Gift size={20} strokeWidth={1.8} />
                    <span className="text-[10px] font-semibold leading-none">
                      {jaRecebidoHoje ? 'Recebido' : 'Receber'}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {recompensa && (
        <PopupRecompensa recompensa={recompensa} onFechar={() => setRecompensa(null)} />
      )}
    </div>
  );
}

/**
 * Pop-up flutuante "Você recebeu:" — mesmo padrão visual usado no resto do
 * app pra pop-ups flutuantes (ver components/ConquistaDetalheModal.js:
 * overlay escurecido + animação popupFlutuante), só que compacto (não é
 * uma tela cheia de detalhe, é uma confirmação rápida).
 */
function PopupRecompensa({ recompensa, onFechar }) {
  const { pontosGanhos, dracmaGanho, jaRecebidoHoje } = recompensa;
  const nadaConfigurado = !jaRecebidoHoje && !pontosGanhos && !dracmaGanho;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-coffee-900/50 p-4 backdrop-blur-sm"
      onClick={onFechar}
    >
      <div
        className="relative w-[280px] max-w-full animate-popupFlutuante rounded-3xl bg-cream px-6 py-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onFechar} className="absolute right-3 top-3 rounded-full p-1 text-coffee-400">
          <X size={18} />
        </button>

        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-coffee-700">
          <Gift size={26} className="text-gold-soft" strokeWidth={1.8} />
        </span>

        {jaRecebidoHoje ? (
          <>
            <p className="mt-4 font-destaque text-base font-semibold text-coffee-800">
              Você já recebeu hoje
            </p>
            <p className="mt-1.5 text-sm text-coffee-500">
              Volta amanhã pra resgatar a recompensa do próximo Verso do Dia.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 font-destaque text-base font-semibold text-coffee-800">Você recebeu:</p>
            {nadaConfigurado ? (
              <p className="mt-1.5 text-sm text-coffee-500">
                Nenhuma recompensa configurada por enquanto — volta outra hora!
              </p>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-1.5">
                {pontosGanhos > 0 && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-coffee-700">
                    <Coins size={16} className="text-gold" />
                    {pontosGanhos} Ponto{pontosGanhos === 1 ? '' : 's'} de Comunhão
                  </span>
                )}
                {dracmaGanho > 0 && (
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-coffee-700">
                    <DracmaIcon size={16} className="text-gold" />
                    {dracmaGanho} Dracma
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
