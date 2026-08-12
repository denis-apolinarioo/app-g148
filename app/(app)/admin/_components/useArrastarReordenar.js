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
// `itensVisuais` reflete a ordem em tempo real durante o arraste (feedback
// visual imediato, a lista "abre espaço" conforme o dedo passa por cima).
// Ao soltar, chama `onReordenar(listaFinal)` só se a ordem realmente mudou —
// quem usa o hook decide como persistir (grava a nova `ordem` no Firestore
// em lote e recarrega).
//
// EFEITO FLUTUANTE: `propsDoItem` já devolve o estilo do item "levantado"
// (sombra mais forte, fica por cima dos outros, acompanha o dedo/mouse
// verticalmente) sempre que ele é o item sendo arrastado no momento — quem
// usa o hook não precisa fazer nada a mais além de espalhar propsDoItem/
// propsDaAlca, como já fazia.
//
// CORREÇÃO (arraste "não funcionava"): faltava setPointerCapture — no
// toque, se o dedo escorregasse um pixel pra fora da alça logo no início do
// gesto, o navegador podia interpretar aquilo como scroll da lista e
// cancelar o arraste antes dele começar de verdade. Além disso, sem nenhum
// feedback visual (sem o efeito flutuante de agora), mesmo quando o arraste
// funcionava tecnicamente, parecia que não tinha feito nada.
// ============================================================================
export function useArrastarReordenar(lista, onReordenar) {
  const [itensVisuais, setItensVisuais] = useState(lista);
  const [arrastando, setArrastando] = useState(false);
  const indiceRef = useRef(null);
  const listaAoIniciarRef = useRef(lista);
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
      if (indiceRef.current === null) return;
      const y = e.clientY;

      // Acompanha o dedo/mouse verticalmente (o "flutuar"): mexe direto no
      // estilo do elemento que já está na tela, sem esperar um re-render do
      // React — fica suave em qualquer quantidade de itens na lista.
      const elArrastado = refsLinhas.current[indiceRef.current];
      if (elArrastado) {
        elArrastado.style.transform = `translateY(${y - yInicialRef.current}px) scale(1.03)`;
      }

      let novoIndice = refsLinhas.current.length - 1;
      for (let i = 0; i < refsLinhas.current.length; i += 1) {
        const el = refsLinhas.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (y < rect.top + rect.height / 2) {
          novoIndice = i;
          break;
        }
      }
      if (novoIndice === indiceRef.current) return;
      setItensVisuais((atual) => {
        const copia = [...atual];
        const [item] = copia.splice(indiceRef.current, 1);
        copia.splice(novoIndice, 0, item);
        return copia;
      });
      // O item flutuante muda de posição no layout — reancora o Y inicial
      // na posição atual do dedo, senão o deslocamento acumulado desde o
      // início do arraste ficaria errado depois da troca de lugar.
      yInicialRef.current = y;
      if (elArrastado) elArrastado.style.transform = 'scale(1.03)';
      indiceRef.current = novoIndice;
    }

    function aoSoltar() {
      const elArrastado = refsLinhas.current[indiceRef.current];
      if (elArrastado) elArrastado.style.transform = '';
      setArrastando(false);
      indiceRef.current = null;
      setItensVisuais((atual) => {
        const original = listaAoIniciarRef.current;
        const mudou =
          atual.length !== original.length || atual.some((item, i) => item.id !== original[i]?.id);
        if (mudou) onReordenar(atual);
        return atual;
      });
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
    const flutuando = arrastando && index === indiceRef.current;
    return {
      ref: (el) => {
        refsLinhas.current[index] = el;
      },
      style: flutuando
        ? {
            position: 'relative',
            zIndex: 20,
            boxShadow: '0 12px 28px rgba(44, 31, 20, 0.28)',
            transition: 'box-shadow 150ms ease',
          }
        : { transition: 'box-shadow 150ms ease' },
    };
  }

  function propsDaAlca(index) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        listaAoIniciarRef.current = itensVisuais;
        indiceRef.current = index;
        yInicialRef.current = e.clientY;
        setArrastando(true);
      },
      style: { touchAction: 'none' },
    };
  }

  return { itensVisuais, propsDoItem, propsDaAlca, arrastando };
}
