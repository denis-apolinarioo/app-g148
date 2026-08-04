'use client';

import { useEffect, useState } from 'react';
import { Music, Sparkles, UserX, UserCheck } from 'lucide-react';
import Avatar from '@/components/Avatar';
import StreakFogueira from '@/components/StreakFogueira';
import AchievementBadge from '@/components/AchievementBadge';
import VitrineConquistas from '@/components/VitrineConquistas';
import PostCard from '@/components/PostCard';
import PrayerCard from '@/components/PrayerCard';
import EmptyState from '@/components/EmptyState';
import ImageViewerModal from '@/components/ImageViewerModal';
import {
  subscribeToUserPosts,
  subscribeToUserPrayers,
  toggleBlockUser,
  updateUserProfile,
} from '@/lib/firestore-helpers';
import { getConquistasDoUsuario, marcarConquistaVista, getVitrineConquistas } from '@/lib/achievements';
import { useAppConfig } from '@/lib/useAppConfig';
import { CHAVE_BLOQUEIO_USUARIO_ATIVO } from '@/lib/appConfig';

export default function ProfileView({ usuario, usuarioAtual }) {
  const [posts, setPosts] = useState(null);
  const [pedidosAtivos, setPedidosAtivos] = useState([]);
  const [conquistas, setConquistas] = useState([]);
  const [aba, setAba] = useState('posts');
  const [fotoAberta, setFotoAberta] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);

  // Item 12 do Bloco 5 — o Admin pode desligar a função de bloqueio pra todo
  // mundo (aba Config); enquanto o app ainda não carregou a configuração,
  // assume ativo (comportamento de sempre).
  const config = useAppConfig();
  const bloqueioAtivo = config?.[CHAVE_BLOQUEIO_USUARIO_ATIVO] !== false;

  const ehOutraPessoa = usuarioAtual?.uid && usuarioAtual.uid !== usuario.uid;
  const jaBloqueado = usuarioAtual?.bloqueados?.includes(usuario.uid);

  async function handleAlternarBloqueio() {
    if (bloqueando) return;
    setBloqueando(true);
    try {
      await toggleBlockUser(usuarioAtual.uid, usuario.uid, jaBloqueado);
    } catch (err) {
      console.error('Erro ao bloquear/desbloquear usuário:', err);
    } finally {
      setBloqueando(false);
    }
  }

  useEffect(() => {
    if (!usuario?.uid) return undefined;
    const unsub = subscribeToUserPosts(usuario.uid, setPosts);
    return () => unsub();
  }, [usuario?.uid]);

  useEffect(() => {
    if (!usuario?.uid) return undefined;
    const unsub = subscribeToUserPrayers(usuario.uid, (todos) => {
      setPedidosAtivos(todos.filter((p) => p.status === 'ativo'));
    });
    return () => unsub();
  }, [usuario?.uid]);

  useEffect(() => {
    if (!usuario?.uid) return;
    getConquistasDoUsuario(usuario.uid).then(setConquistas);
  }, [usuario?.uid]);

  // Chamado pela AchievementBadge depois que a animação do cadeado abrindo
  // termina — marca como vista no Firestore e atualiza a tela na hora, sem
  // esperar recarregar a aba inteira.
  function handleAbrirConquista(achievementId) {
    if (usuarioAtual?.uid !== usuario.uid) return; // só o dono pode "abrir" as próprias conquistas
    setConquistas((atual) =>
      atual.map((c) => (c.id === achievementId ? { ...c, visto: true } : c))
    );
    marcarConquistaVista(usuario.uid, achievementId).catch((err) => {
      console.error('Erro ao marcar conquista como vista:', err);
    });
  }

  // Salva a escolha da vitrine (até 3 conquistas em destaque no topo do
  // perfil). `usuario` aqui só é editável de verdade quando é o próprio
  // dono (ver ProfileView usado em /perfil, que passa o perfil ao vivo via
  // AuthProvider) — a tela pública de outra pessoa nunca chama isso, já que
  // o botão da vitrine só é clicável pro dono.
  async function handleSalvarVitrine(novaSelecao) {
    await updateUserProfile(usuario.uid, { vitrineConquistas: novaSelecao });
  }

  return (
    <div className="px-4 pb-8 pt-5">
      <div className="flex flex-col items-center text-center">
        {/* Cabeçalho em duas colunas: identidade à esquerda, métricas à
            direita — pedido do usuário pra imitar a disposição de um
            layout de referência que ele mandou. */}
        <div className="flex w-full items-start justify-between gap-3">
          {/* Esquerda: foto, nome, usuário e função */}
          <div className="flex flex-col items-start text-left">
            {/* FIX: foto de perfil clicável abre em tela cheia */}
            <button onClick={() => usuario.fotoURL && setFotoAberta(true)} className="rounded-full">
              <Avatar src={usuario.fotoURL} nome={usuario.nome} tamanho="lg" />
            </button>
            <h1 className="mt-2 font-destaque text-lg font-semibold text-coffee-800">{usuario.nome}</h1>
            <p className="text-sm text-coffee-400">@{usuario.username}</p>

            {usuario.tagFuncao && usuario.tagFuncao !== 'Membro' && (
              <span className="mt-2 rounded-full bg-coffee-100 px-3 py-1 text-xs font-medium text-coffee-600">
                {usuario.tagFuncao}
              </span>
            )}
          </div>

          {/* Direita: vitrine de conquistas (bem no topo, alinhada com nome/
              usuário/função à esquerda), depois pontos e streak (fogueira)
              logo abaixo — tudo na mesma linha do cabeçalho, sem seção
              extra */}
          <div className="flex flex-shrink-0 flex-col items-end gap-2">
            <VitrineConquistas
              usuario={usuario}
              usuarioAtual={usuarioAtual}
              conquistas={conquistas}
              vitrine={getVitrineConquistas(usuario, conquistas)}
              onSalvar={handleSalvarVitrine}
            />
            <div className="flex items-center gap-2">
              <div className="rounded-xl2 border border-coffee-100 bg-cream-card px-4 py-2.5 text-center shadow-card">
                <p className="font-destaque text-lg font-bold text-coffee-800">{usuario.pontos || 0}</p>
                <p className="text-[11px] text-coffee-300">Pontos de Comunhão</p>
              </div>
              <StreakFogueira dias={usuario.streakAtual || 0} />
            </div>
          </div>
        </div>

        {ehOutraPessoa && bloqueioAtivo && (
          <button
            onClick={handleAlternarBloqueio}
            disabled={bloqueando}
            className="mt-4 flex items-center gap-1.5 rounded-full border border-coffee-200 px-3 py-1.5 text-xs font-medium text-coffee-500 disabled:opacity-50"
          >
            {jaBloqueado ? <UserCheck size={13} /> : <UserX size={13} />}
            {jaBloqueado ? 'Desbloquear' : 'Bloquear'}
          </button>
        )}

        {usuario.bio && <p className="mt-3 max-w-xs text-sm text-coffee-600">{usuario.bio}</p>}

        {usuario.proposito && (
          <div className="mt-5 w-full max-w-xs rounded-xl2 border border-coffee-100 bg-cream-card p-4 text-left shadow-card">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-coffee-500">
              <Sparkles size={13} /> Propósito
            </p>
            <p className="mt-1 text-sm italic text-coffee-600">{usuario.proposito}</p>
          </div>
        )}

        {usuario.musicaFavorita && (
          <div className="mt-2.5 flex w-full max-w-xs items-center gap-2 rounded-xl2 border border-coffee-100 bg-cream-card p-4 text-left shadow-card">
            <Music size={16} className="flex-shrink-0 text-coffee-400" />
            <p className="text-sm text-coffee-600">{usuario.musicaFavorita}</p>
          </div>
        )}
      </div>

      {/* FIX: conquistas viram terceira aba, não ficam soltas acima */}
      <div className="mt-7">
        <div className="mb-3 flex gap-4 border-b border-coffee-100">
          <AbaBtn ativo={aba === 'posts'} onClick={() => setAba('posts')} label="Posts" />
          <AbaBtn
            ativo={aba === 'oracoes'}
            onClick={() => setAba('oracoes')}
            label={`Orações${pedidosAtivos.length ? ` (${pedidosAtivos.length})` : ''}`}
          />
          <AbaBtn
            ativo={aba === 'conquistas'}
            onClick={() => setAba('conquistas')}
            label={`Conquistas (${conquistas.filter((c) => c.desbloqueada).length}/${conquistas.length})`}
          />
        </div>

        {aba === 'posts' && (
          <div className="space-y-4">
            {posts === null && <div className="h-24 animate-pulse rounded-xl2 bg-coffee-100/60" />}
            {posts?.length === 0 && <EmptyState titulo="Nenhum post ainda" />}
            {/* Botão "Ocultar" (novo) — post oculto some do perfil de todo
                mundo, exceto do próprio dono (placeholder, ver PostCard.js)
                e do Admin (sempre vê tudo). */}
            {posts
              ?.filter((post) => !post.oculto || usuario.uid === usuarioAtual?.uid || usuarioAtual?.isAdmin)
              .map((post) => (
                <PostCard key={post.id} post={post} usuarioAtual={usuarioAtual} />
              ))}
          </div>
        )}

        {aba === 'oracoes' && (
          <div className="space-y-3">
            {pedidosAtivos.length === 0 && <EmptyState titulo="Nenhum pedido ativo" />}
            {pedidosAtivos.map((p) => (
              <PrayerCard key={p.id} pedido={p} />
            ))}
          </div>
        )}

        {aba === 'conquistas' && (
          <div className="grid grid-cols-5 gap-2.5 pt-1">
            {conquistas.length === 0 && <div className="h-24 animate-pulse rounded-xl2 bg-coffee-100/60" />}
            {conquistas.map((c) => (
              <AchievementBadge key={c.id} conquista={c} onAberta={handleAbrirConquista} />
            ))}
          </div>
        )}
      </div>

      {/* Modal foto de perfil em tela cheia */}
      {fotoAberta && usuario.fotoURL && (
        <ImageViewerModal
          src={usuario.fotoURL}
          alt={usuario.nome}
          onClose={() => setFotoAberta(false)}
        />
      )}
    </div>
  );
}

function AbaBtn({ ativo, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`border-b-2 pb-2.5 text-sm font-medium ${
        ativo ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
      }`}
    >
      {label}
    </button>
  );
}
