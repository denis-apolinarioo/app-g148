'use client';

import { useRef, useState, useEffect } from 'react';

// ============================================================================
// Hook pra reordenar uma lista arrastando com o dedo/mouse, além das
// setinhas de mover pra cima/baixo (que continuam funcionando à parte,
// chamando a mesma função de trocar ordem de sempre). Usa Pointer Events —
// funciona igual com toque e mouse, sem depender de nenhuma biblioteca,
// pensado pro painel Admin funcionar bem tanto no desktop quanto no celular
// (o app é um PWA).
//
// Uso:
//   const { itensVisuais, propsDoItem, propsDaAlca } = useArrastarReordenar(
//     categorias,
//     (novaOrdem) => reordenarCategoriasAcao(novaOrdem).then(carregar)
//   );
//
//   itensVisuais.map((item, index) => (
//     <div key={item.id} {...propsDoItem(index)}>
//       <span {...propsDaAlca(index)}><GripVertical size={14} /></span>
//       ...
//     </div>
//   ));
//
// REESCRITA (arraste "bugado"/precoce — item de baixo subindo antes da hora,
// comportamento imprevisível): a versão anterior recalculava a ORDEM DO
// ARRAY a cada movimento do dedo, e decidia a nova posição comparando a
// posição de CADA linha (inclusive a que está sendo arrastada, que segue o
// dedo o tempo todo) contra o ponteiro — comparar um alvo que sempre se move
// junto com o próprio ponteiro é logicamente instável, e cada reordenação do
// array forçava reancorar a origem do arraste, acumulando pequenos saltos.
//
// Lógica nova, direta: o ARRAY REAL (itensVisuais) só muda quando solta o
// dedo. Durante o arraste, SÓ efeito visual (transform) acontece:
//   1) A linha arrastada segue o dedo verticalmente, sempre relativa à
//      posição OFICIAL de início do arraste (nunca reancorada — sem saltos).
//   2) As posições ORIGINAIS de todas as linhas são medidas 1 vez, no
//      instante em que o dedo pressiona a alça (antes de qualquer
//      transform) — e ficam congeladas até soltar. Comparar o dedo contra
//      posições congeladas das OUTRAS linhas (nunca contra a própria linha
//      arrastada) é uma comparação estável e previsível.
//   3) A cada movimento, conta quantas outras linhas têm o meio ORIGINAL
//      acima do dedo agora — essa contagem É o índice de destino (2 linhas
//      acima do dedo = o item pertence à posição 2, depois delas). Sem
//      caso especial, sem loop com "break", sem ambiguidade.
//   4) As linhas ENTRE a origem e o destino atual deslizam (translateY,
//      com transição suave) pra posição ORIGINAL da vizinha mais perto do
//      buraco — "abre espaço" com uma animação de verdade, em vez de um
//      salto seco de re-render. Funciona mesmo com linhas de altura
//      diferente, porque usa a posição MEDIDA de cada linha, não uma altura
//      fixa presumida.
//   5) Só ao soltar o dedo o array de verdade é reordenado (uma vez só) e
//      `onReordenar` é chamado — e só se a posição final for diferente da
//      inicial.
// ============================================================================
export function useArrastarReordenar(lista, onReordenar) {
  const [itensVisuais, setItensVisuais] = useState(lista);
  const [arrastando, setArrastando] = useState(false);
  // Dispara re-render sempre que o destino do arraste muda de verdade (pra
  // recalcular quais linhas devem deslizar) — sem virar um re-render a cada
  // pixel de movimento do dedo, só quando o índice de destino muda mesmo.
  const [indiceAlvo, setIndiceAlvo] = useState(null);
  const indiceOrigemRef = useRef(null);
  const indiceAlvoRef = useRef(null);
  // [{ top, meio }] de cada linha, medido 1 vez no pointerdown, ANTES de
  // qualquer transform — fica congelado até soltar (ver item 2 acima).
  const posicoesIniciaisRef = useRef([]);
  const refsLinhas = useRef([]);
  const yInicialRef = useRef(0);

  // Sincroniza com a lista de fora (ex.: recarregou do Firestore, ou quem
  // chama passou uma lista filtrada/mapeada — nova referência a cada
  // render) sempre que não estiver no meio de um arraste. Compara pelo
  // CONTEÚDO (sequência de ids), não pela referência do array: se quem usa
  // o hook passar uma lista filtrada (nova referência a cada render, mesmo
  // conteúdo), isso evita disparar um re-render à toa a cada vez — o que
  // viraria um loop, já que cada re-render recalcularia a lista filtrada de
  // novo.
  useEffect(() => {
    if (arrastando) return;
    setItensVisuais((atual) => {
      const mudou =
        atual.length !== lista.length || atual.some((item, i) => item.id !== lista[i]?.id);
      return mudou ? lista : atual;
    });
  }, [lista, arrastando]);

  useEffect(() => {
    if (!arrastando) return undefined;

    function aoMover(e) {
      const origem = indiceOrigemRef.current;
      if (origem === null) return;
      const y = e.clientY;

      // Acompanha o dedo/mouse verticalmente (o "flutuar"): mexe direto no
      // estilo do elemento que já está na tela, sem esperar um re-render do
      // React — fica suave em qualquer quantidade de itens na lista. SEMPRE
      // relativo à posição inicial do dedo (nunca reancorada), então o
      // movimento é contínuo do início ao fim do arraste, sem saltos.
      const elArrastado = refsLinhas.current[origem];
      if (elArrastado) {
        elArrastado.style.transform = `translateY(${y - yInicialRef.current}px) scale(1.03)`;
      }

      // Quantas OUTRAS linhas (nunca a própria arrastada) têm o meio
      // ORIGINAL acima do dedo agora? Essa contagem é o novo índice de
      // destino — ver item 3 do comentário grande no topo do arquivo.
      let novoAlvo = 0;
      posicoesIniciaisRef.current.forEach((pos, i) => {
        if (i === origem) return;
        if (pos.meio < y) novoAlvo += 1;
      });

      if (novoAlvo !== indiceAlvoRef.current) {
        indiceAlvoRef.current = novoAlvo;
        setIndiceAlvo(novoAlvo);
      }
    }

    function aoSoltar() {
      const origem = indiceOrigemRef.current;
      const alvo = indiceAlvoRef.current;
      const elArrastado = refsLinhas.current[origem];
      if (elArrastado) elArrastado.style.transform = '';

      setArrastando(false);
      indiceOrigemRef.current = null;
      indiceAlvoRef.current = null;
      setIndiceAlvo(null);

      // Reordena o array de verdade só agora — uma vez só — e só se a
      // posição realmente mudou (ver item 5 do comentário grande).
      if (origem !== null && alvo !== null && origem !== alvo) {
        setItensVisuais((atual) => {
          const copia = [...atual];
          const [item] = copia.splice(origem, 1);
          copia.splice(alvo, 0, item);
          onReordenar(copia);
          return copia;
        });
      }
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

  function propsDoItem(index) {
    const origem = indiceOrigemRef.current;
    const éLinhaArrastada = arrastando && index === origem;

    // "Abre espaço": enquanto arrasta, as linhas ENTRE a origem e o alvo
    // atual deslizam pra posição ORIGINAL da vizinha mais perto do buraco —
    // ver item 4 do comentário grande no topo do arquivo. Usa a posição
    // MEDIDA de cada linha (posicoesIniciaisRef), não uma altura fixa
    // presumida, então funciona igual com linhas de altura diferente.
    let deslocamento = 0;
    if (arrastando && !éLinhaArrastada && origem !== null && indiceAlvo !== null) {
      const posDestaLinha = posicoesIniciaisRef.current[index];
      if (posDestaLinha) {
        if (indiceAlvo > origem && index > origem && index <= indiceAlvo) {
          // Arrastando pra baixo: as linhas entre a origem e o alvo sobem
          // uma posição — cada uma ocupa o lugar de onde a anterior estava.
          const posAnterior = posicoesIniciaisRef.current[index - 1];
          if (posAnterior) deslocamento = posAnterior.top - posDestaLinha.top;
        } else if (indiceAlvo < origem && index < origem && index >= indiceAlvo) {
          // Arrastando pra cima: as linhas entre o alvo e a origem descem
          // uma posição — cada uma ocupa o lugar de onde a seguinte estava.
          const posSeguinte = posicoesIniciaisRef.current[index + 1];
          if (posSeguinte) deslocamento = posSeguinte.top - posDestaLinha.top;
        }
      }
    }

    return {
      ref: (el) => {
        refsLinhas.current[index] = el;
      },
      style: éLinhaArrastada
        ? {
            position: 'relative',
            zIndex: 20,
            boxShadow: '0 12px 28px rgba(44, 31, 20, 0.28)',
            transition: 'box-shadow 150ms ease',
          }
        : {
            transform: deslocamento ? `translateY(${deslocamento}px)` : undefined,
            transition: 'transform 150ms ease, box-shadow 150ms ease',
          },
    };
  }

  function propsDaAlca(index) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        indiceOrigemRef.current = index;
        indiceAlvoRef.current = index;
        yInicialRef.current = e.clientY;
        // Mede a posição de TODAS as linhas AGORA, antes de qualquer
        // transform ser aplicado — essas medidas ficam congeladas até o
        // fim do arraste (ver item 2 do comentário grande no topo do
        // arquivo), não são reconsultadas a cada movimento.
        posicoesIniciaisRef.current = refsLinhas.current.map((el) => {
          if (!el) return { top: 0, meio: 0 };
          const rect = el.getBoundingClientRect();
          return { top: rect.top, meio: rect.top + rect.height / 2 };
        });
        setIndiceAlvo(index);
        setArrastando(true);
      },
      style: { touchAction: 'none' },
    };
  }

  return { itensVisuais, propsDoItem, propsDaAlca, arrastando };
}
