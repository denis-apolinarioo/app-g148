'use client';

// Item 11 do Bloco 4 — central de configurações do app. Ainda não existe
// nenhuma configuração de verdade (isso é o item 12º); essa aba já lê o
// documento config/appSettings pra provar que a base (lib/appConfig.js)
// está funcionando, e vai ganhar os controles de verdade no próximo bloco.

import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { getConfiguracoesApp } from '@/lib/appConfig';

export default function AbaConfiguracoes() {
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    getConfiguracoesApp().then(() => setCarregado(true));
  }, []);

  if (!carregado) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  return (
    <EmptyState
      icone={Settings}
      titulo="Central de configurações"
      descricao="Em breve, as opções gerais do app vão aparecer aqui."
    />
  );
}
