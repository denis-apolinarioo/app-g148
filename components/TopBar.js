import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function TopBar({ titulo, voltarPara, acao }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-coffee-100 bg-cream/95 px-4 py-3.5 backdrop-blur pt-[calc(env(safe-area-inset-top)+0.875rem)]">
      {voltarPara && (
        <Link
          href={voltarPara}
          className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-full text-coffee-600"
        >
          <ChevronLeft size={22} />
        </Link>
      )}
      <h1 className="flex-1 truncate font-destaque text-lg font-semibold text-coffee-800">
        {titulo}
      </h1>
      {acao}
    </header>
  );
}
