'use client';

import Link from 'next/link';

// ============================================================================
// CORREÇÃO DE BUG: links colados em posts/mensagens apareciam como texto
// puro, sem ficar clicáveis. Este componente quebra o texto em pedaços,
// identifica URLs via regex, e transforma cada uma num link de verdade —
// sem alterar o resto do texto nem exigir mudança no que já foi salvo no
// banco (funciona em cima de qualquer texto já existente).
//
// Também linka @menções (mesmo padrão usado em addComment pra notificar)
// pro perfil da pessoa — funciona mesmo se @algo não corresponder a
// nenhum usuário real, só vira um link que cai em "usuário não encontrado".
// ============================================================================

const REGEX_URL_OU_MENCAO = /(https?:\/\/[^\s]+|www\.[^\s]+|@[a-zA-Z0-9_.]+)/gi;

export default function TextoComLinks({ texto, className = '' }) {
  if (!texto) return null;

  const partes = texto.split(REGEX_URL_OU_MENCAO);

  return (
    <span className={className}>
      {partes.map((parte, i) => {
        if (parte.startsWith('@') && parte.length > 1) {
          return (
            <Link
              key={i}
              href={`/u/${parte.slice(1)}`}
              className="text-coffee-600 font-medium hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {parte}
            </Link>
          );
        }
        if (parte.match(REGEX_URL_OU_MENCAO)) {
          const href = parte.startsWith('http') ? parte : `https://${parte}`;
          return (
            <a
              key={i}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-coffee-600 underline underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              {parte}
            </a>
          );
        }
        return <span key={i}>{parte}</span>;
      })}
    </span>
  );
}
