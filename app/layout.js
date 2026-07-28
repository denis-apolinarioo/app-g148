'use client';
import { useState, useEffect } from 'react';

export default function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    // Tempo total de exibição da Splash (2 segundos de brilho + 0.5s de transição)
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2000);

    // Remove o componente do HTML após a animação de fade acabar
    const removeTimer = setTimeout(() => {
      setShouldRender(false);
    }, 2500);

    return () => {
      clearTimeout(timer);
      clearTimeout(removeTimer);
    };
  }, []);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#5B3A29] transition-opacity duration-500 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex flex-col items-center animate-pulse">
        {/* LOGO G148 VETORIZADO */}
        <svg
          width="180"
          height="120"
          viewBox="0 0 200 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Texto G148 */}
          <text
            x="50%"
            y="60"
            textAnchor="middle"
            fill="#F5EDE3"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '700',
              fontSize: '68px',
            }}
          >
            G148
          </text>
          {/* Retângulo Arredondado para ITUMBIARA */}
          <rect
            x="10"
            y="75"
            width="180"
            height="35"
            rx="8"
            fill="#F5EDE3"
          />
          {/* Texto ITUMBIARA */}
          <text
            x="50%"
            y="100"
            textAnchor="middle"
            fill="#5B3A29"
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '600',
              fontSize: '22px',
              letterSpacing: '1px'
            }}
          >
            ITUMBIARA
          </text>
        </svg>
      </div>
      
      {/* Indicador de carregamento discreto */}
      <div className="mt-8 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-[#F5EDE3] animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-2 h-2 rounded-full bg-[#F5EDE3] animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-2 h-2 rounded-full bg-[#F5EDE3] animate-bounce"></div>
      </div>
    </div>
  );
}
