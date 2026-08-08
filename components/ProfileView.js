'use client';

import { useEffect, useState } from 'react';
import { UserX, UserCheck } from 'lucide-react';
import Avatar from '@/components/Avatar';
import StreakFogueira from '@/components/StreakFogueira';
import AchievementBadge from '@/components/AchievementBadge';
import VitrineConquistas from '@/components/VitrineConquistas';
import PostCard from '@/components/PostCard';
import PrayerCard from '@/components/PrayerCard';
import EmptyState from '@/components/EmptyState';
import ImageViewerModal from '@/components/ImageViewerModal';
import ConquistaDetalheModal from '@/components/ConquistaDetalheModal';
import CrossIcon from '@/components/icons/CrossIcon';
import NavPostIcon from '@/components/icons/NavPostIcon';
import NavMedalIcon from '@/components/icons/NavMedalIcon';
import PrayingHandsIcon from '@/components/PrayingHandsIcon';
import {
  subscribeToUserPosts,
  subscribeToUserPrayers,
  toggleBlockUser,
  updateUserProfile,
} from '@/lib/firestore-helpers';
import { getConquistasDoUsuario, marcarConquistaVista, getVitrineConquistas } from '@/lib/achievements';
import { useAppConfig } from '@/lib/useAppConfig';
import { CHAVE_BLOQUEIO_USUARIO_ATIVO } from '@/lib/appConfig';
import { todayBrasilia } from '@/lib/dateUtils';

// CORREÇÃO MODO ESCURO — Ícones das abas do Perfil (Posts/Orações/
// Conquistas) usavam PNGs recortados da imagem de referência
// (public/icons/custom/), com a cor "gravada" no arquivo — por isso não
// invertiam junto com o tema (ver html.dark .text-coffee-700/300 em
// app/globals.css) e ficavam escuros/ilegíveis no modo escuro, diferente
// dos ícones que já herdavam cor via className. Troca pelos equivalentes em
// SVG que já existiam prontos no projeto (components/icons/NavPostIcon.js,
// components/icons/NavMedalIcon.js e components/PrayingHandsIcon.js) mas
// não tinham sido ligados aqui — mesmo desenho, com stroke/fill
// "currentColor", herdando cor do mesmo jeito que o resto do app.
function IconePosts({ size, strokeWidth, ativo }) {
  return (
    <NavPostIcon size={size} strokeWidth={strokeWidth} className={ativo ? 'text-coffee-700' : 'text-coffee-300'} />
  );
}

function IconeOracoesPerfil({ size, strokeWidth, ativo }) {
  return (
    <PrayingHandsIcon
      size={size}
      strokeWidth={strokeWidth}
      className={ativo ? 'text-coffee-700' : 'text-coffee-300'}
    />
  );
}

function IconeConquistas({ size, ativo }) {
  return <NavMedalIcon size={size} className={ativo ? 'text-coffee-700' : 'text-coffee-300'} />;
}

const POSTS_POR_PAGINA = 8;

export default function ProfileView({ usuario, usuarioAtual, abrirConquistaId }) {
  const [posts, setPosts] = useState(null);
  const [pedidosOracao, setPedidosOracao] = useState([]);
  const [conquistas, setConquistas] = useState([]);
  const [aba, setAba] = useState('posts');
  const [fotoAberta, setFotoAberta] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  // Paginação local — evita montar todos os AudioPlayers de uma vez quando
  // o usuário tem muitos posts de áudio, o que sobrecarregava o aparelho e
  // causava o "Application error" na tela de Perfil.
  const [quantosPostsVisiveis, setQuantosPostsVisiveis] = useState(POSTS_POR_PAGINA);
  // Item novo — deep link vindo de uma notificação de conquista (Correio ou
  // push, ver lib/achievements.js e functions/index.js). Só o próprio dono
  // consegue abrir assim, já que conquista é algo pessoal.
  const [conquistaAlvoFechada, setConquistaAlvoFechada] = useState(false);

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
    setQuantosPostsVisiveis(POSTS_POR_PAGINA); // reseta ao trocar de usuário
    const unsub = subscribeToUserPosts(usuario.uid, setPosts);
    return () => unsub();
  }, [usuario?.uid]);

  useEffect(() => {
    if (!usuario?.uid) return undefined;
    const unsub = subscribeToUserPrayers(usuario.uid, (todos) => {
      // Todos os pedidos do usuário, com os ativos primeiro (dentro de cada
      // grupo mantém a ordem que já vem de subscribeToUserPrayers — mais
      // recente primeiro).
      const ativos = todos.filter((p) => p.status === 'ativo');
      const outros = todos.filter((p) => p.status !== 'ativo');
      setPedidosOracao([...ativos, ...outros]);
    });
    return () => unsub();
  }, [usuario?.uid]);

  useEffect(() => {
    if (!usuario?.uid) return;
    getConquistasDoUsuario(usuario.uid).then(setConquistas);
  }, [usuario?.uid]);

  // Item novo — ao chegar em /perfil?conquista=<id>, já abre direto na aba
  // certa. A troca só acontece uma vez (não força de volta se a pessoa sair
  // da aba Conquistas manualmente depois).
  const donoEhUsuarioAtual = !!usuarioAtual?.uid && usuarioAtual.uid === usuario?.uid;
  useEffect(() => {
    if (abrirConquistaId && donoEhUsuarioAtual) {
      setAba('conquistas');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirConquistaId, donoEhUsuarioAtual]);

  const conquistaAlvo =
    abrirConquistaId && donoEhUsuarioAtual && !conquistaAlvoFechada
      ? conquistas.find((c) => c.id === abrirConquistaId && c.desbloqueada)
      : null;

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
    <div className="px-4 pb-8 pt-3">
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
          {/* pr-1.5: reduzido pra empurrar a vitrine mais pra direita (pedido
              do usuário) — ainda sobra uma margem mínima pra moldura
              dourada da última medalha não cortar na borda da tela. */}
          <div className="-mt-3 ml-auto flex flex-shrink-0 flex-col items-end pr-1.5">
            <div className="flex items-end gap-2">
              <div className="rounded-xl2 border border-coffee-200 bg-coffee-100 px-4 py-2.5 text-center shadow-card">
                <p className="font-destaque text-lg font-bold text-coffee-800">{usuario.pontos || 0}</p>
                <p className="text-[11px] text-coffee-500">Pontos de Comunhão</p>
              </div>
              <StreakFogueira
                dias={usuario.streakAtual || 0}
                aceso={!!usuario.ultimoDiaAtivo && usuario.ultimoDiaAtivo === todayBrasilia()}
              />
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
            largura igual à dos posts (sem max-w), com destaque visual (faixa
            marrom lateral + cruz latina sólida, no lugar do dourado usado
            antes — pedido do usuário). Fundo marrom claro (coffee-100, em
            vez do card quase branco) pra contrastar mais com o resto da
            tela. */}
        {usuario.proposito && (
          <div className="relative mt-5 w-full overflow-hidden rounded-xl2 border border-coffee-200 bg-coffee-100 p-4 pl-5 text-left shadow-card">
            <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-coffee-400 to-coffee-700" />
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-coffee-600">
              <CrossIcon size={14} className="text-coffee-600" /> Propósito
            </p>
            <p className="mt-1 text-sm italic text-coffee-700">{usuario.proposito}</p>
          </div>
        )}
      </div>

      {/* Abas em estilo "Instagram" — só ícone, sem texto (pedido do
          usuário); o label continua existindo como aria-label pra leitor de
          tela, e o `title` mostra a contagem no hover em telas maiores.
          mt-2.5 (era mt-5) — distância reduzida entre o card de Propósito
          logo acima e os ícones das abas, pedido do usuário. */}
      <div className="mt-2.5">
        <div className="mb-3 flex border-b border-coffee-100">
          <AbaBtn
            ativo={aba === 'posts'}
            onClick={() => setAba('posts')}
            icone={IconePosts}
            label="Posts"
          />
          <AbaBtn
            ativo={aba === 'oracoes'}
            onClick={() => setAba('oracoes')}
            icone={IconeOracoesPerfil}
            label={`Orações${pedidosOracao.length ? ` (${pedidosOracao.length})` : ''}`}
          />
          <AbaBtn
            ativo={aba === 'conquistas'}
            onClick={() => setAba('conquistas')}
            icone={IconeConquistas}
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
            {/* slice: mostra só os primeiros N posts pra não montar todos os
                AudioPlayers de uma vez (causa crash em perfis com muitos
                posts de áudio — ver bug fix em AudioPlayer.js). */}
            {posts
              ?.filter((post) => !post.oculto || usuario.uid === usuarioAtual?.uid || usuarioAtual?.isAdmin)
              .slice(0, quantosPostsVisiveis)
              .map((post) => (
                <PostCard key={post.id} post={post} usuarioAtual={usuarioAtual} />
              ))}
            {posts &&
              posts.filter((post) => !post.oculto || usuario.uid === usuarioAtual?.uid || usuarioAtual?.isAdmin)
                .length > quantosPostsVisiveis && (
              <button
                onClick={() => setQuantosPostsVisiveis((n) => n + POSTS_POR_PAGINA)}
                className="w-full rounded-xl2 border border-coffee-200 py-3 text-sm font-medium text-coffee-600 hover:bg-coffee-50"
              >
                Ver mais posts
              </button>
            )}
          </div>
        )}

        {aba === 'oracoes' && (
          <div className="space-y-3">
            {pedidosOracao.length === 0 && <EmptyState titulo="Nenhum pedido ainda" />}
            {pedidosOracao.map((p) => (
              <PrayerCard key={p.id} pedido={p} />
            ))}
          </div>
        )}

        {aba === 'conquistas' && (
          <div className="grid grid-cols-5 gap-x-3 gap-y-4 pt-1">
            {conquistas.length === 0 && <div className="h-24 animate-pulse rounded-xl2 bg-coffee-100/60" />}
            {conquistas.map((c) => (
              <AchievementBadge key={c.id} conquista={c} uid={usuario.uid} onAberta={handleAbrirConquista} />
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

      {/* Item novo — conquista aberta via notificação (?conquista=id).
          Reaproveita o mesmo "marcar como vista" do toque normal no
          emblema (handleAbrirConquista), pra não deixar o cadeado
          pendurado esperando um segundo toque. */}
      {conquistaAlvo && (
        <ConquistaDetalheModal
          conquista={conquistaAlvo}
          uid={usuario.uid}
          onFechar={() => {
            if (!conquistaAlvo.visto) handleAbrirConquista(conquistaAlvo.id);
            setConquistaAlvoFechada(true);
          }}
        />
      )}
    </div>
  );
}

function AbaBtn({ ativo, onClick, icone: Icone, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex flex-1 items-center justify-center border-b-2 pb-2.5 pt-2 transition-colors ${
        ativo ? 'border-coffee-700 text-coffee-800' : 'border-transparent text-coffee-300'
      }`}
    >
      <Icone size={30} strokeWidth={ativo ? 2.1 : 1.7} ativo={ativo} />
    </button>
  );
}
