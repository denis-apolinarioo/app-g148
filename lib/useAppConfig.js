'use client';

import { useEffect, useState } from 'react';
import { subscribeToConfiguracoesApp } from './appConfig';

/**
 * Hook que devolve o documento de configurações gerais do app (config/appSettings),
 * atualizado em tempo real. Retorna `null` enquanto ainda não chegou a primeira
 * leitura — quem usa deve tratar isso como "assume o padrão" pra não travar a
 * tela esperando (ver CHAVE_BLOQUEIO_USUARIO_ATIVO em lib/appConfig.js).
 */
export function useAppConfig() {
  const [config, setConfig] = useState(null);

  useEffect(() => {
    const unsub = subscribeToConfiguracoesApp(setConfig);
    return () => unsub();
  }, []);

  return config;
}
