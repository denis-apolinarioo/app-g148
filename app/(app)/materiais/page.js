'use client';

import { useEffect, useState } from 'react';
import { Box } from 'lucide-react';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/EmptyState';
import ImageViewerModal from '@/components/ImageViewerModal';
import { getTodosOsMateriais } from '@/lib/materiaisRepo';

// Item novo — tela de Materiais, aberta pelo ícone de caixa no topo do
// Perfil. Cada material é uma capa (imagem cortada 1:1) + nome; tocar em
// qualquer parte do cartão abre o conteúdo, que pode ser outra imagem
// (tela cheia, reaproveitando o ImageViewerModal), um PDF (aba nova — o
// navegador já tem leitor embutido) ou um link externo (aba nova).
//
// Substitui a ideia antiga de 7 links fixos (Bíblia, Spotify, Drive do
// livro do bimestre, calendário etc.) — agora é uma lista que o Admin
// monta livremente pela aba Materiais, sem número fixo.
export default function MateriaisPage() {
  const [materiais, setMateriais] = useState(null);
  const [imagemAberta, setImagemAberta] = useState('');

  useEffect(() => {
    getTodosOsMateriais().then((todos) => {
      setMateriais(todos.filter((m) => m.ativo !== false));
    });
  }, []);

  function abrirMaterial(material) {
    if (!material.conteudoURL) return;
    if (material.tipo === 'imagem') {
      setImagemAberta(material.conteudoURL);
    } else {
      // 'pdf' e 'link' abrem do mesmo jeito — numa aba nova. Pra PDF, é o
      // navegador do celular/computador que mostra o leitor embutido.
      window.open(material.conteudoURL, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar titulo="Materiais" voltarPara="/perfil" />

      <div className="px-4 py-4">
        {materiais === null ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-square animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        ) : materiais.length === 0 ? (
          <EmptyState
            icone={Box}
            titulo="Nenhum material por aqui ainda"
            descricao="Em breve o Admin adiciona os primeiros."
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {materiais.map((material) => (
              <button
                key={material.id}
                type="button"
                onClick={() => abrirMaterial(material)}
                className="overflow-hidden rounded-xl2 border border-coffee-100 bg-cream-card text-left shadow-card"
              >
                <div className="aspect-square w-full overflow-hidden bg-coffee-50">
                  {material.capaURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={material.capaURL}
                      alt={material.nome}
                      draggable={false}
                      onContextMenu={(e) => e.preventDefault()}
                      className="h-full w-full select-none object-cover [-webkit-touch-callout:none]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Box size={28} className="text-coffee-200" />
                    </div>
                  )}
                </div>
                <p className="truncate px-2.5 py-2 text-xs font-semibold text-coffee-800">
                  {material.nome}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {imagemAberta && (
        <ImageViewerModal src={imagemAberta} alt="Material" onClose={() => setImagemAberta('')} />
      )}
    </div>
  );
}
