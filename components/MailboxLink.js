'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Mailbox } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToUnreadMailCount } from '@/lib/firestore-helpers';

/**
 * Item 30 — Ícone do Correio com bolinha de não lidas. Reaproveitado no
 * cabeçalho do Feed e do Perfil.
 */
export default function MailboxLink({ size = 22 }) {
  const { perfil } = useAuth();
  const [naoLidas, setNaoLidas] = useState(0);

  useEffect(() => {
    if (!perfil?.uid) return undefined;
    const unsub = subscribeToUnreadMailCount(perfil.uid, setNaoLidas);
    return () => unsub();
  }, [perfil?.uid]);

  return (
    <Link href="/correio" className="relative text-coffee-500">
      <Mailbox size={size} />
      {naoLidas > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
          {naoLidas > 9 ? '9+' : naoLidas}
        </span>
      )}
    </Link>
  );
}
