'use client';

import { useEffect, useRef, useState } from 'react';

// ============================================================================
// Item 1 do Bloco A — utilitário de UI OTIMISTA reutilizável.
// ----------------------------------------------------------------------------
// ANTES: curtir post, curtir comentário e "Orei por isso" resolviam o mesmo
// problema 3 vezes, cada um na mão: o botão ficava com `disabled` e só
// atualizava visualmente DEPOIS que o Firestore confirmava (await direto em
// PostCard.js, CommentSection.js e PrayerCard.js). Isso dá sensação de app
// mais lento do que precisa.
//
// AGORA: este hook resolve o padrão "muda a tela na hora, desfaz se der
// erro" uma vez só. Os itens 5º/6º/7º do Bloco B (curtir post, curtir
// comentário, "Orei por isso") só precisam plugar nele — nenhuma tela foi
// alterada por este item, só a base foi criada.
//
// Como usar (exemplo — curtir post):
//   const [jaCurtiuExibido, disparar, pendente] = useAcaoOtimista(jaCurtiu);
//   <button
//     disabled={pendente}
//     onClick={() =>
//       disparar(!jaCurtiuExibido, () =>
//         toggleLike(post.id, usuarioAtual.uid, jaCurtiu, contexto)
//       )
//     }
//   >
//
// - `valorDoServidor`: o valor "de verdade" (ex.: derivado de post.curtidas,
//   que chega via onSnapshot). Sempre que ele mudar e alcançar o que já
//   estamos mostrando otimisticamente, o hook para de sobrepor sozinho.
// - `disparar(valorOtimista, executar)`: já troca a tela pra `valorOtimista`
//   na hora, roda `executar` (deve retornar uma Promise) em segundo plano, e
//   desfaz sozinho — volta pro valor de antes da ação — se `executar`
//   rejeitar. O erro é relançado, então quem chamou ainda pode tratar/logar.
// - `pendente`: true enquanto `executar` não resolveu — usar em `disabled`
//   pra evitar duplo toque, exatamente como o `curtindo`/`orando` de hoje.
// ============================================================================
export function useAcaoOtimista(valorDoServidor) {
  const [override, setOverride] = useState(undefined);
  const [pendente, setPendente] = useState(false);
  const overrideRef = useRef(override);
  overrideRef.current = override;

  // Assim que o valor real (do servidor) alcança o que já mostramos
  // otimisticamente, para de sobrepor — volta a confiar 100% no servidor.
  useEffect(() => {
    if (overrideRef.current !== undefined && valorDoServidor === overrideRef.current) {
      setOverride(undefined);
    }
  }, [valorDoServidor]);

  async function disparar(valorOtimista, executar) {
    const valorParaDesfazer = overrideRef.current !== undefined ? overrideRef.current : valorDoServidor;
    setOverride(valorOtimista);
    setPendente(true);
    try {
      await executar();
    } catch (err) {
      // Desfaz — volta pro valor de antes desta ação específica.
      setOverride(valorParaDesfazer);
      throw err;
    } finally {
      setPendente(false);
    }
  }

  const valorExibido = override !== undefined ? override : valorDoServidor;
  return [valorExibido, disparar, pendente];
}
