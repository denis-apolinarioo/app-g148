'use client';

import { useEffect, useState } from 'react';
import * as Icons from 'lucide-react';
import { UserX, UserCheck, LayoutGrid, HandHeart, Award } from 'lucide-react';
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

// Ícone de cruz pro card de Propósito — acesso defensivo (em vez de import
// nomeado direto) porque nem toda versão do lucide-react garante o mesmo
// nome exportado; cai num ícone genérico de destaque se "Cross" não
// existir nesta versão instalada, em vez de quebrar a tela inteira.
const IconeProposito = Icons.Cross || Icons.Sparkle || Icons.Sparkles;

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
        {/* flex-wrap (em vez de só justify-between): em telas bem estreitas
            o bloco da direita (pontos+fogueira+vitrine) não cabe do lado do
            avatar/nome e ESPREME tudo, ficando desalinhado — com flex-wrap
            ele desce inteiro pra baixo, numa linha própria, em vez de
            estourar a largura. ml-auto no bloco da direita (mais abaixo)
            mantém ele alinhado à direita tanto numa linha quanto na outra. */}
        <div className="flex w-full flex-wrap items-start gap-x-3 gap-y-3">
          {/* Esquerda: foto, nome, usuário e função */}
          <div className="flex min-w-0 flex-1 flex-col items-start text-left">
            {/* FIX: foto de perfil clicável abre em tela cheia */}
            <button onClick={() => usuario.fotoURL && setFotoAberta(true)} className="rounded-full">
              <Avatar src={usuario.fotoURL} nome={usuario.nome} tamanho={72} />
            </button>
            {/* Nome e @usuário padronizados em 1 linha só, com corte (…) se
                não couberem — evita que nomes compostos grandes quebrem o
                layout ou empurrem o card de pontos. Limite de digitação já
                calibrado no Editar Perfil (28 caracteres). */}
            <h1 className="mt-2 max-w-full truncate font-destaque text-lg font-semibold text-coffee-800">
              {usuario.nome}
            </h1>
            <p className="max-w-full truncate text-sm text-coffee-400">@{usuario.username}</p>

            {usuario.tagFuncao && (
              <span className="mt-2 max-w-full truncate rounded-full bg-coffee-100 px-3 py-1 text-xs font-medium text-coffee-600">
                {usuario.tagFuncao}
              </span>
            )}
          </div>

          {/* Direita: pontos, streak (fogueira) e vitrine de conquistas.
              items-end (em vez de items-center) alinha o rótulo "X dias" da
              fogueira com o rótulo "Pontos de Comunhão" do card ao lado —
              ver o ajuste de padding equivalente em StreakFogueira.js. */}
          <div className="-mt-3 ml-auto flex flex-shrink-0 flex-col items-end">
            <div className="flex items-end gap-2">
              <div className="rounded-xl2 border border-coffee-100 bg-cream-card px-4 py-2.5 text-center shadow-card">
                <p className="font-destaque text-lg font-bold text-coffee-800">{usuario.pontos || 0}</p>
                <p className="text-[11px] text-coffee-300">Pontos de Comunhão</p>
              </div>
              <StreakFogueira dias={usuario.streakAtual || 0} />
            </div>

            <VitrineConquistas
              usuario={usuario}
              usuarioAtual={usuarioAtual}
              conquistas={conquistas}
              vitrine={getVitrineConquistas(usuario, conquistas)}
              onSalvar={handleSalvarVitrine}
            />
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

        {/* Propósito — último item do cabeçalho antes das abas de baixo,
            largura igual à dos posts (sem max-w), com mais destaque visual
            (faixa dourada lateral + ícone de cruz, mais alinhado ao tema da
            comunidade do que o antigo ícone de estrelas). */}
        {usuario.proposito && (
          <div className="relative mt-5 w-full overflow-hidden rounded-xl2 border border-coffee-100 bg-cream-card p-4 pl-5 text-left shadow-card">
            <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold to-coffee-600" />
            <p className="flex items-center gap-1.5 text-xs font-semibold text-coffee-500">
              <IconeProposito size={14} className="text-gold" strokeWidth={2.2} /> Propósito
            </p>
            <p className="mt-1 text-sm italic text-coffee-600">{usuario.proposito}</p>
          </div>
        )}
      </div>

      {/* Abas em estilo "Instagram" — ícone + contagem, 3 seções iguais
          (posts à esquerda, orações no centro, conquistas à direita). */}
      <div className="mt-7">
        <div className="mb-3 flex border-b border-coffee-100">
          <AbaBtn
            ativo={aba === 'posts'}
            onClick={() => setAba('posts')}
            icone={LayoutGrid}
            label="Posts"
          />
          <AbaBtn
            ativo={aba === 'oracoes'}
            onClick={() => setAba('oracoes')}
            icone={HandHeart}
            label={`Orações${pedidosAtivos.length ? ` (${pedidosAtivos.length})` : ''}`}
          />
          <AbaBtn
            ativo={aba === 'conquistas'}
            onClick={() => setAba('conquistas')}
            icone={Award}
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

function AbaBtn({ ativo, onClick, icone: Icone, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 border-b-2 pb-2.5 pt-1 transition-colors ${
        ativo ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
      }`}
    >
      <Icone size={19} strokeWidth={ativo ? 2.2 : 1.8} />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </button>
  );
}
