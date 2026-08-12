'use client';

import { useRef, useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { hexParaHsl, hslParaHex, clamp } from '@/lib/paletaGerador';

// ============================================================================
// SELETOR DE COR EM ROLETA — substitui o <input type="color"> nativo (que no
// Android/iOS abre uma paleta genérica do sistema, sem cara nenhuma do app)
// por uma roda de matiz+saturação de verdade, com barra de luminosidade
// embaixo e 5 cores rápidas pra começar — pedido explícito: "a mais bonita
// que tem e mais intuitiva".
//
// COMO FUNCIONA A RODA: matiz (hue, 0-360°) é o ÂNGULO ao redor do círculo,
// medido a partir das 12h, sentido horário — bate exatamente com o
// `conic-gradient` usado no fundo (ver estiloRoda abaixo). Saturação é a
// DISTÂNCIA até o centro (0% no meio = cinza, 100% na borda = cor pura). A
// luminosidade NÃO cabe na roda (ela é bidimensional, luminosidade é a 3ª
// dimensão do HSL) — fica na barra de baixo, um gradiente preto -> cor pura
// -> branco.
//
// Arrastar funciona com Pointer Events (mouse E toque), mesmo padrão de
// useArrastarReordenar.js: pointerdown captura o ponteiro E LIGA os
// listeners de pointermove/pointerup no window inteiro (não só em cima do
// círculo/barra) — assim continua seguindo o dedo mesmo se escorregar um
// pouco pra fora durante o arraste, comum numa roda pequena em tela de
// celular.
// ============================================================================
const CORES_RAPIDAS_PADRAO = ['#6B4A2F', '#3E6690', '#4E8C6B', '#B5686B', '#7A5C99'];

export default function RoletaCor({ valor, onChange, coresRapidas = CORES_RAPIDAS_PADRAO }) {
  const rodaRef = useRef(null);
  const barraRef = useRef(null);
  const [arrastando, setArrastando] = useState(null); // null | 'roda' | 'barra'
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const hslRef = useRef(hexParaHsl(valor || '#6B4A2F'));

  const hsl = hexParaHsl(valor || '#6B4A2F');
  hslRef.current = hsl;

  function moverNaRoda(clientX, clientY) {
    const rect = rodaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centroX = rect.left + rect.width / 2;
    const centroY = rect.top + rect.height / 2;
    const raio = rect.width / 2;

    const dx = clientX - centroX;
    const dy = clientY - centroY;
    const distancia = Math.min(Math.sqrt(dx * dx + dy * dy), raio);

    // Ângulo medido a partir das 12h, sentido horário — ver comentário
    // grande no topo do arquivo. atan2 já dá o ângulo "matemático" (a
    // partir das 3h, sentido anti-horário porque a tela cresce pra baixo);
    // +90 gira pra começar nas 12h e inverte pro sentido horário certo.
    const anguloTela = Math.atan2(dy, dx) * (180 / Math.PI);
    const matiz = (anguloTela + 90 + 360) % 360;
    const saturacao = (distancia / raio) * 100;

    onChangeRef.current(hslParaHex({ h: matiz, s: clamp(saturacao, 0, 100), l: hslRef.current.l }));
  }

  function moverNaBarra(clientX) {
    const rect = barraRef.current?.getBoundingClientRect();
    if (!rect) return;
    const proporcao = clamp((clientX - rect.left) / rect.width, 0, 1);
    onChangeRef.current(hslParaHex({ h: hslRef.current.h, s: hslRef.current.s, l: proporcao * 100 }));
  }

  useEffect(() => {
    if (!arrastando) return undefined;

    function aoMover(e) {
      if (arrastando === 'roda') moverNaRoda(e.clientX, e.clientY);
      else moverNaBarra(e.clientX);
    }
    function aoSoltar() {
      setArrastando(null);
    }

    window.addEventListener('pointermove', aoMover);
    window.addEventListener('pointerup', aoSoltar);
    window.addEventListener('pointercancel', aoSoltar);
    return () => {
      window.removeEventListener('pointermove', aoMover);
      window.removeEventListener('pointerup', aoSoltar);
      window.removeEventListener('pointercancel', aoSoltar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrastando]);

  function aoPressionarRoda(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArrastando('roda');
    moverNaRoda(e.clientX, e.clientY);
  }

  function aoPressionarBarra(e) {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setArrastando('barra');
    moverNaBarra(e.clientX);
  }

  // Posição do marcador na roda: converte (matiz, saturação) de volta pra
  // (x, y) relativo ao centro — o inverso exato da conta em moverNaRoda.
  const anguloRad = ((hsl.h - 90) * Math.PI) / 180;
  const raioMarcador = (clamp(hsl.s, 0, 100) / 100) * 50; // % do raio da roda
  const marcadorX = 50 + raioMarcador * Math.cos(anguloRad);
  const marcadorY = 50 + raioMarcador * Math.sin(anguloRad);

  // Fundo da roda: conic-gradient faz o matiz dar a volta (mesma convenção
  // de ângulo — 12h, sentido horário), radial-gradient por cima esmaece
  // pro branco no centro, simulando a saturação caindo a 0.
  const estiloRoda = {
    backgroundImage:
      'radial-gradient(circle at center, white 0%, transparent 72%), ' +
      'conic-gradient(from 0deg, hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%))',
  };

  const corPuraDoMatiz = hslParaHex({ h: hsl.h, s: hsl.s, l: 50 });

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-4">
        {/* A roda em si — matiz + saturação. */}
        <div
          ref={rodaRef}
          onPointerDown={aoPressionarRoda}
          className="relative h-32 w-32 flex-shrink-0 touch-none rounded-full shadow-inner"
          style={estiloRoda}
        >
          <span
            className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{ left: `${marcadorX}%`, top: `${marcadorY}%`, backgroundColor: valor }}
          />
        </div>

        <div className="min-w-0 flex-1 space-y-3 pt-1">
          {/* Prévia + hex — o hex continua editável direto, pra quem
              preferir digitar/colar um código exato em vez de arrastar. */}
          <div className="flex items-center gap-2.5 rounded-lg border border-coffee-100 bg-cream-card px-3 py-2">
            <span
              className="h-8 w-8 flex-shrink-0 rounded-full border border-coffee-100"
              style={{ backgroundColor: valor }}
            />
            <input
              value={valor}
              onChange={(e) => {
                const v = e.target.value.toUpperCase();
                if (/^#[0-9A-F]{0,6}$/.test(v)) onChange(v);
              }}
              maxLength={7}
              className="w-full min-w-0 bg-transparent font-mono text-xs text-coffee-500 outline-none"
            />
          </div>

          {/* Barra de luminosidade — a 3ª dimensão que não cabe na roda. */}
          <div
            ref={barraRef}
            onPointerDown={aoPressionarBarra}
            className="relative h-6 touch-none rounded-full"
            style={{
              backgroundImage: `linear-gradient(to right, #000000, ${corPuraDoMatiz}, #FFFFFF)`,
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
              style={{ left: `${clamp(hsl.l, 0, 100)}%`, backgroundColor: valor }}
            />
          </div>
        </div>
      </div>

      {/* Até 5 cores rápidas — um toque já aplica; pra qualquer outra cor
          além dessas 5, é só usar a roda/barra acima ("o restante vai de
          acordo com a edição"). */}
      {coresRapidas?.length > 0 && (
        <div className="flex items-center gap-2">
          {coresRapidas.slice(0, 5).map((cor) => {
            const selecionada = cor.toUpperCase() === (valor || '').toUpperCase();
            return (
              <button
                key={cor}
                type="button"
                onClick={() => onChange(cor.toUpperCase())}
                aria-label={`Usar a cor ${cor}`}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2"
                style={{
                  backgroundColor: cor,
                  borderColor: selecionada ? '#FFFFFF' : 'transparent',
                  boxShadow: selecionada ? '0 0 0 1.5px rgb(var(--cor-coffee-400))' : 'none',
                }}
              >
                {selecionada && <Check size={13} className="text-white drop-shadow" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
