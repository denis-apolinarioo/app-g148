'use client';

// ============================================================================
// CORREÇÃO DE BUG: links colados em posts/mensagens apareciam como texto
// puro, sem ficar clicáveis. Este componente quebra o texto em pedaços,
// identifica URLs via regex, e transforma cada uma num link de verdade —
// sem alterar o resto do texto nem exigir mudança no que já foi salvo no
// banco (funciona em cima de qualquer texto já existente).
// ============================================================================

const REGEX_URL = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export default function TextoComLinks({ texto, className = '' }) {
  if (!texto) return null;

  const partes = texto.split(REGEX_URL);

  return (
    <span className={className}>
      {partes.map((parte, i) => {
        if (parte.match(REGEX_URL)) {
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
