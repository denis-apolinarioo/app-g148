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
// ============================================================================
export function useArrastarReordenar(lista, onReordenar) {
  const [itensVisuais, setItensVisuais] = useState(lista);
  const [arrastando, setArrastando] = useState(false);
  const indiceRef = useRef(null);
  const listaAoIniciarRef = useRef(lista);
  const refsLinhas = useRef([]);

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
      indiceRef.current = novoIndice;
    }

    function aoSoltar() {
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
    return {
      ref: (el) => {
        refsLinhas.current[index] = el;
      },
    };
  }

  function propsDaAlca(index) {
    return {
      onPointerDown: (e) => {
        e.preventDefault();
        listaAoIniciarRef.current = itensVisuais;
        indiceRef.current = index;
        setArrastando(true);
      },
      style: { touchAction: 'none' },
    };
  }

  return { itensVisuais, propsDoItem, propsDaAlca, arrastando };
}
