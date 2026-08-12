'use client';

import { WifiOff } from 'lucide-react';
import { useConexao } from '@/lib/connectivity';

/**
 * Item 2 do Bloco A — banner fixo avisando quando o app está sem conexão.
 * Some sozinho assim que a conexão volta (ver lib/connectivity.js).
 */
export default function ConexaoBanner() {
  const offline = useConexao();

  if (!offline) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-forte-800 px-4 py-2 text-xs font-medium text-cream">
      <WifiOff size={14} />
      Sem conexão — tentando reconectar...
    </div>
  );
}
