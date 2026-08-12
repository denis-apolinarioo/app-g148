'use client';

// Toggle simples, sem dependência externa — usado na tela de preferências
// de notificação (Bloco 10) pra ligar/desligar categorias e o horário de
// silêncio.
export default function ToggleSwitch({ ativo, onChange, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativo}
      disabled={disabled}
      onClick={() => onChange(!ativo)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        ativo ? 'bg-forte' : 'bg-coffee-100'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-[rgb(var(--cor-cream))] shadow transition-transform ${
          ativo ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
