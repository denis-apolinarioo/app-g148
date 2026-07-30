'use client';

import { useEffect, useState } from 'react';
import { getUsuarioCache } from './usersCache';

/**
 * Hook que resolve nome/foto/username atuais de um autor a partir do uid,
 * sempre em dia (nunca mostra dado antigo de quando o post foi criado).
 * Enquanto carrega, usa o `fallback` (dado antigo salvo no post, se houver)
 * pra não piscar "Usuário" na tela por uma fração de segundo.
 */
export function useUsuarioAtual(uid, fallback = {}) {
  const [dados, setDados] = useState({
    nome: fallback.nome || '...',
    fotoURL: fallback.fotoURL || '',
    username: fallback.username || '',
  });

  useEffect(() => {
    let ativo = true;
    if (!uid) return undefined;
    getUsuarioCache(uid).then((resultado) => {
      if (ativo && resultado) setDados(resultado);
    });
    return () => {
      ativo = false;
    };
  }, [uid]);

  return dados;
}
