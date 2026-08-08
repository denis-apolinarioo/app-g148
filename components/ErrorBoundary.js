'use client';

import { Component } from 'react';
import { AlertTriangle } from 'lucide-react';

// Boundary genérico: se algo quebrar durante o render de quem está dentro
// dele, em vez da tela de "Application error" do Next (que só mostra
// detalhe no console do navegador), mostra o erro de verdade na própria
// tela — mensagem + stack — com um botão de copiar. Serve pra conseguir
// o erro certo sem precisar abrir o F12.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: '' };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ error, stack: info?.componentStack || '' });
  }

  render() {
    if (this.state.error) {
      const texto = `${this.state.error.message || this.state.error}\n${this.state.stack}`;
      return (
        <div className="space-y-3 rounded-xl2 border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle size={16} />
            <p className="text-sm font-semibold">Essa tela quebrou — erro abaixo</p>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white p-2.5 text-[11px] text-red-800">
            {texto}
          </pre>
          <button
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(texto).catch(() => {});
              }
            }}
            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700"
          >
            Copiar erro
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
