'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileQuestion } from 'lucide-react';
import TopBar from '@/components/TopBar';
import PostCard from '@/components/PostCard';
import EmptyState from '@/components/EmptyState';
import { useAuth } from '@/components/AuthProvider';
import { subscribeToPost } from '@/lib/firestore-helpers';

// Tela de post individual — usada pelo botão "Ver post" da aba de Denúncias
// do Admin (item 17), pra ir direto no post denunciado (inclusive quando a
// denúncia é de um COMENTÁRIO, já que o comentário mora dentro do post),
// pelo clique numa notificação de curtida/comentário no Correio (item 15º
// do Bloco 7), e pelo botão "encaminhar" do MissionCard na tela de Missões
// (CORREÇÃO DE BUG: leva ao post gerado pela missão, inclusive o "de
// bastidor" — missaoSemFeed:true — das missões que não postam no Feed, ver
// lib/points.js e PostCard.js). O Feed continua sendo a lista normal, essa
// rota é só um "atalho" direto pra um post pelo ID — por isso o botão de
// voltar usa o histórico do navegador em vez de um destino fixo (as
// origens são diferentes entre si).
export default function PostIndividualPage() {
  const { postId } = useParams();
  const { perfil } = useAuth();
  const [post, setPost] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!postId) return undefined;
    const unsub = subscribeToPost(postId, (p) => {
      setPost(p);
      setCarregando(false);
    });
    return () => unsub();
  }, [postId]);

  return (
    <div className="mx-auto max-w-2xl">
      <TopBar titulo="Post" voltarPorHistorico />

      <div className="space-y-4 px-4 py-4">
        {carregando && <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />}

        {!carregando && !post && (
          <EmptyState
            icone={FileQuestion}
            titulo="Post não encontrado"
            descricao="Esse post pode ter sido apagado."
          />
        )}

        {post && <PostCard post={post} usuarioAtual={perfil} />}
      </div>
    </div>
  );
}
