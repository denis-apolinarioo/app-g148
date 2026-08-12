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
// REESCRITA 1 (arraste "bugado"/precoce — item de baixo subindo antes da
// hora): a versão original recalculava a ORDEM DO ARRAY a cada movimento do
// dedo, e decidia a nova posição comparando a posição de CADA linha
// (inclusive a que está sendo arrastada, que segue o dedo o tempo todo)
// contra o ponteiro — comparar um alvo que sempre se move junto com o
// próprio ponteiro é logicamente instável. Virou: o ARRAY REAL só muda ao
// soltar; durante o arraste as posições ORIGINAIS de todas as linhas são
// medidas 1 vez (no pointerdown, antes de qualquer transform) e ficam
// congeladas — comparar o dedo contra posições congeladas das OUTRAS linhas
// (nunca contra a própria arrastada) é estável e previsível.
//
// REESCRITA 2 (lagzinho entre a linha arrastada e as vizinhas "abrindo
// espaço"): a linha arrastada sempre se moveu direto no DOM (`el.style.
// transform = ...`, fora do ciclo do React — por isso ela sempre pareceu
// suave). As vizinhas, porém, dependiam de `setIndiceAlvo` -> re-render do
// React -> propsDoItem recalcula o `transform` -> commit — um caminho mais
// lento que fica meio passo atrás do dedo, especialmente com bastante item
// na lista. Virou: o deslocamento das vizinhas TAMBÉM é escrito direto no
// DOM, na mesma função aoMover que já move a linha arrastada — os dois
// halves da animação agora saem do mesmo lugar, no mesmo instante, sem
// esperar o React. O React só re-renderiza no início/fim do arraste (pra
// aplicar a sombra na linha levantada), nunca a cada movimento do dedo.
// ============================================================================
export function useArrastarReordenar(lista, onReordenar) {
  const [itensVisuais, setItensVisuais] = useState(lista);
  const [arrastando, setArrastando] = useState(false);
  const indiceOrigemRef = useRef(null);
  const indiceAlvoRef = useRef(null);
  // [{ top, meio }] de cada linha, medido 1 vez no pointerdown, ANTES de
  // qualquer transform — fica congelado até soltar.
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

  // Aplica (ou limpa, com deslocamento 0) o transform de TODAS as linhas
  // que precisam "abrir espaço" pro alvo atual — direto no DOM, sem passar
  // pelo React (ver REESCRITA 2 no comentário grande do topo). Chamada de
  // dentro de aoMover a cada mudança de alvo, e de novo em aoSoltar (com
  // alvo = origem, ou seja, zera tudo) pra garantir que nenhuma linha fique
  // com deslocamento residual quando o array de verdade assume a posição
  // final.
  function aplicarDeslocamentos(origem, alvo) {
    refsLinhas.current.forEach((el, i) => {
      if (!el || i === origem) return;
      const posDestaLinha = posicoesIniciaisRef.current[i];
      if (!posDestaLinha) return;

      let deslocamento = 0;
      if (alvo > origem && i > origem && i <= alvo) {
        // Arrastando pra baixo: as linhas entre a origem e o alvo sobem uma
        // posição — cada uma ocupa o lugar de onde a anterior estava.
        const posAnterior = posicoesIniciaisRef.current[i - 1];
        if (posAnterior) deslocamento = posAnterior.top - posDestaLinha.top;
      } else if (alvo < origem && i < origem && i >= alvo) {
        // Arrastando pra cima: as linhas entre o alvo e a origem descem uma
        // posição — cada uma ocupa o lugar de onde a seguinte estava.
        const posSeguinte = posicoesIniciaisRef.current[i + 1];
        if (posSeguinte) deslocamento = posSeguinte.top - posDestaLinha.top;
      }
      el.style.transform = deslocamento ? `translateY(${deslocamento}px)` : '';
    });
  }

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
      // destino — sem caso especial, sem loop com "break", sem ambiguidade.
      let novoAlvo = 0;
      posicoesIniciaisRef.current.forEach((pos, i) => {
        if (i === origem) return;
        if (pos.meio < y) novoAlvo += 1;
      });

      if (novoAlvo !== indiceAlvoRef.current) {
        indiceAlvoRef.current = novoAlvo;
        // Direto no DOM, na mesma função que já move a linha arrastada
        // acima — sem esperar um re-render do React (ver REESCRITA 2).
        aplicarDeslocamentos(origem, novoAlvo);
      }
    }

    function aoSoltar() {
      const origem = indiceOrigemRef.current;
      const alvo = indiceAlvoRef.current;
      const elArrastado = refsLinhas.current[origem];
      if (elArrastado) elArrastado.style.transform = '';
      // Zera o deslocamento de qualquer linha que ainda estivesse "aberta"
      // — o array de verdade (abaixo) já vai assumir essa mesma posição
      // final sem transform nenhum, então nada pode ficar deslocado depois.
      if (origem !== null) aplicarDeslocamentos(origem, origem);

      setArrastando(false);
      indiceOrigemRef.current = null;
      indiceAlvoRef.current = null;

      // Reordena o array de verdade só agora — uma vez só — e só se a
      // posição realmente mudou.
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
    const éLinhaArrastada = arrastando && index === indiceOrigemRef.current;
    return {
      ref: (el) => {
        refsLinhas.current[index] = el;
      },
      // Nenhum dos dois ramos mexe em `transform` — ele é 100% controlado
      // via DOM direto (aoMover/aplicarDeslocamentos acima), nunca pelo
      // React, então o React nunca "briga" com esses valores nem os reseta
      // sozinho num re-render no meio do arraste (ver REESCRITA 2).
      style: éLinhaArrastada
        ? {
            position: 'relative',
            zIndex: 20,
            boxShadow: '0 12px 28px rgba(44, 31, 20, 0.28)',
            transition: 'box-shadow 150ms ease',
          }
        : { transition: 'transform 150ms ease, box-shadow 150ms ease' },
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
        // fim do arraste, não são reconsultadas a cada movimento (senão
        // ficariam contaminadas pelos próprios deslocamentos que a gente
        // aplica durante o arraste).
        posicoesIniciaisRef.current = refsLinhas.current.map((el) => {
          if (!el) return { top: 0, meio: 0 };
          const rect = el.getBoundingClientRect();
          return { top: rect.top, meio: rect.top + rect.height / 2 };
        });
        setArrastando(true);
      },
      style: { touchAction: 'none' },
    };
  }

  return { itensVisuais, propsDoItem, propsDaAlca, arrastando };
}
