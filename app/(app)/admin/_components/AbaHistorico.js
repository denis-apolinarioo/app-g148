'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { History, Search } from 'lucide-react';
import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { subscribeToAcoesAdmin, buscarAcoesAdminPorUsuario } from '@/lib/adminLog';
import { getAllUsers } from '@/lib/firestore-helpers';
import { combinaComBusca } from '@/lib/searchUtils';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { CHAVE_BLOQUEIO_USUARIO_ATIVO } from '@/lib/appConfig';

// Rótulo de reserva pra qualquer ação que ainda não tenha um título
// dedicado em <TituloRegistro> abaixo — evita mostrar o identificador cru
// (ex.: "editar_missao") se um dia surgir uma ação nova sem ajuste ainda.
const ROTULO_RESERVA = {
  ajustar_pontos: 'Ajuste manual de pontos',
  travar_usuario: 'Bloqueou um usuário',
  destravar_usuario: 'Desbloqueou um usuário',
  editar_configuracoes_app: 'Configuração alterada',
  criar_missao: 'Missão criada',
  editar_missao: 'Missão editada',
  excluir_missao: 'Missão excluída',
  ajustar_pontos_acao: 'Pontos de uma ação ajustados',
  resolver_denuncia: 'Denúncia marcada como resolvida',
  reabrir_denuncia: 'Denúncia reaberta',
};

// Ações em que o nome da pessoa já entra dentro do próprio título — nesses
// casos não repete "em Fulano" numa segunda linha.
const ACOES_COM_NOME_NO_TITULO = ['ajustar_pontos', 'travar_usuario', 'destravar_usuario'];

// Ações em que mostrar "valor antes → depois" seria redundante (o título
// já diz o que aconteceu) ou não faz sentido (nenhum valor numérico real).
const ACOES_SEM_LINHA_DE_VALOR = ['travar_usuario', 'destravar_usuario', 'editar_configuracoes_app'];

const PAGINA = 15;

export default function AbaHistorico() {
  const [subAba, setSubAba] = useState('recentes'); // 'recentes' | 'buscar'

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 rounded-xl bg-coffee-50 p-1">
        <button
          onClick={() => setSubAba('recentes')}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            subAba === 'recentes' ? 'bg-cream-card text-coffee-800 shadow-sm' : 'text-coffee-400'
          }`}
        >
          Recentes
        </button>
        <button
          onClick={() => setSubAba('buscar')}
          className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            subAba === 'buscar' ? 'bg-cream-card text-coffee-800 shadow-sm' : 'text-coffee-400'
          }`}
        >
          Buscar por pessoa
        </button>
      </div>

      {subAba === 'recentes' ? <HistoricoRecentes /> : <HistoricoPorUsuario />}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Aba "Recentes" — últimos 15 registros, com botão "Ver mais" que carrega
// mais 15 de cada vez (aumenta o limite da mesma escuta em tempo real, em
// vez de paginar com cursor — mais simples e continua atualizando ao vivo).
// ----------------------------------------------------------------------------
function HistoricoRecentes() {
  const [quantidade, setQuantidade] = useState(PAGINA);
  const [registros, setRegistros] = useState(null);
  const [carregandoMais, setCarregandoMais] = useState(false);

  useEffect(() => {
    const unsub = subscribeToAcoesAdmin((dados) => {
      setRegistros(dados);
      setCarregandoMais(false);
    }, quantidade);
    return () => unsub();
  }, [quantidade]);

  if (registros === null) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
        ))}
      </div>
    );
  }

  if (registros.length === 0) {
    return (
      <EmptyState
        icone={History}
        titulo="Nenhum registro ainda"
        descricao="Ações administrativas (ajustar pontos, criar/editar missão, bloquear usuário, etc.) aparecem aqui."
      />
    );
  }

  // Se voltou menos registros do que o limite pedido, não tem mais nada
  // pra carregar (chegou no fim da coleção).
  const podeCarregarMais = registros.length >= quantidade;

  return (
    <div className="space-y-2">
      {registros.map((r) => (
        <LinhaRegistro key={r.id} registro={r} />
      ))}
      {podeCarregarMais && (
        <button
          onClick={() => {
            setCarregandoMais(true);
            setQuantidade((q) => q + PAGINA);
          }}
          disabled={carregandoMais}
          className="w-full rounded-xl border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-50"
        >
          {carregandoMais ? 'Carregando...' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Aba "Buscar por pessoa" — mesmo sistema de busca por nome/@username do
// Feed e do Correio (lib/searchUtils.js -> combinaComBusca): digita, aparece
// a lista com foto + nome + @username, escolhe a pessoa, vê só os ajustes
// feitos nela.
// ----------------------------------------------------------------------------
function HistoricoPorUsuario() {
  const [busca, setBusca] = useState('');
  const [usuarios, setUsuarios] = useState(null);
  const [selecionado, setSelecionado] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    getAllUsers()
      .then(setUsuarios)
      .catch((err) => {
        console.error('[HistoricoPorUsuario] Erro ao carregar usuários:', err);
        setUsuarios([]);
      });
  }, []);

  useEffect(() => {
    if (!selecionado) return;
    setRegistros(null);
    setErro(false);
    buscarAcoesAdminPorUsuario(selecionado.id)
      .then(setRegistros)
      .catch((err) => {
        console.error('[HistoricoPorUsuario] Erro ao buscar histórico:', err);
        setErro(true);
        setRegistros([]);
      });
  }, [selecionado]);

  const usuariosFiltrados = useMemo(() => {
    if (!usuarios || !busca.trim()) return [];
    return usuarios.filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca));
  }, [usuarios, busca]);

  if (selecionado) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => {
            setSelecionado(null);
            setRegistros(null);
          }}
          className="text-xs font-medium text-coffee-500"
        >
          ← Voltar pra busca
        </button>

        <div className="flex items-center gap-2.5">
          <Avatar src={selecionado.fotoURL} nome={selecionado.nome} tamanho="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-coffee-800">{selecionado.nome}</p>
            {selecionado.username && (
              <p className="truncate text-xs text-coffee-400">@{selecionado.username}</p>
            )}
          </div>
        </div>

        {registros === null && (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />
            ))}
          </div>
        )}

        {registros?.length === 0 && !erro && (
          <EmptyState
            icone={History}
            titulo="Nenhum registro encontrado"
            descricao="Essa pessoa ainda não teve nenhuma ação administrativa registrada."
          />
        )}

        {erro && registros?.length === 0 && (
          <EmptyState
            icone={History}
            titulo="Não deu pra carregar"
            descricao="Tenta de novo em alguns segundos."
          />
        )}

        {registros?.map((r) => (
          <LinhaRegistro key={r.id} registro={r} ocultarAlvo />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-coffee-300"
        />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou @username..."
          className="w-full rounded-lg border border-coffee-100 bg-cream-card py-2 pl-8 pr-3 text-sm text-coffee-800"
        />
      </div>

      {usuarios === null && <div className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />}

      {usuarios !== null && !busca.trim() && (
        <p className="px-1 text-xs text-coffee-300">
          Digite um nome ou @username pra ver o histórico dessa pessoa.
        </p>
      )}

      {busca.trim() !== '' && (
        <div className="overflow-hidden rounded-xl border border-coffee-100 bg-cream-card">
          {usuariosFiltrados.length === 0 && (
            <p className="px-3.5 py-3 text-center text-xs text-coffee-400">Ninguém encontrado.</p>
          )}
          {usuariosFiltrados.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelecionado(u)}
              className="flex w-full items-center gap-2.5 border-b border-coffee-50 px-3.5 py-2.5 text-left last:border-b-0"
            >
              <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
                {u.username && <p className="truncate text-xs text-coffee-400">@{u.username}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Título amigável de cada tipo de ação, já com o nome da pessoa/missão/
// denúncia embutido (em vez de mostrar o identificador cru tipo
// "ajustar_pontos" ou valores true/false crus).
// ----------------------------------------------------------------------------
function TituloRegistro({ registro, alvo, mostrarNomeNoTitulo }) {
  const nomeAlvo = mostrarNomeNoTitulo && alvo?.nome && alvo.nome !== '...' ? alvo.nome : null;
  const nomeAlvoLink = nomeAlvo ? (
    <Link href={`/u/${alvo.username || registro.alvoId}`} className="underline decoration-coffee-300">
      {nomeAlvo}
    </Link>
  ) : null;

  switch (registro.acao) {
    case 'ajustar_pontos':
      return nomeAlvoLink ? (
        <>Ajuste manual de pontos do usuário &quot;{nomeAlvoLink}&quot;</>
      ) : (
        'Ajuste manual de pontos'
      );
    case 'travar_usuario':
      return nomeAlvoLink ? <>Bloqueou o usuário &quot;{nomeAlvoLink}&quot;</> : 'Bloqueou um usuário';
    case 'destravar_usuario':
      return nomeAlvoLink ? <>Desbloqueou o usuário &quot;{nomeAlvoLink}&quot;</> : 'Desbloqueou um usuário';
    case 'editar_configuracoes_app':
      if (registro.alvoId === CHAVE_BLOQUEIO_USUARIO_ATIVO) {
        return registro.valorDepois
          ? 'Ativou a função de bloquear usuários'
          : 'Desativou a função de bloquear usuários';
      }
      return 'Configuração alterada';
    case 'criar_missao':
      return <>Criou a missão &quot;{registro.detalhes || registro.alvoId}&quot;</>;
    case 'editar_missao':
      return <>Editou a missão &quot;{registro.detalhes || registro.alvoId}&quot;</>;
    case 'excluir_missao':
      return <>Excluiu a missão &quot;{registro.detalhes || registro.alvoId}&quot;</>;
    case 'ajustar_pontos_acao':
      return <>Ajustou os pontos de &quot;{registro.detalhes || registro.alvoId}&quot;</>;
    case 'resolver_denuncia':
      return <>Marcou como resolvida a denúncia — {registro.detalhes || 'conteúdo removido'}</>;
    case 'reabrir_denuncia':
      return <>Reabriu a denúncia — {registro.detalhes || 'conteúdo removido'}</>;
    default:
      return ROTULO_RESERVA[registro.acao] || registro.acao || 'Ação administrativa';
  }
}

// ----------------------------------------------------------------------------
// Uma linha de registro. `ocultarAlvo` é usado na aba "Buscar por pessoa"
// (já mostramos a pessoa no topo, então o título não precisa repetir o
// nome dela).
// ----------------------------------------------------------------------------
function LinhaRegistro({ registro, ocultarAlvo = false }) {
  const mostrarAlvo = !ocultarAlvo && registro.alvoTipo === 'users' && Boolean(registro.alvoId);
  const alvo = useUsuarioAtual(mostrarAlvo ? registro.alvoId : null);

  let dataFormatada = 'agora';
  if (registro.createdAt) {
    try {
      dataFormatada = formatDateTimeBR(registro.createdAt);
    } catch {
      dataFormatada = '';
    }
  }

  const temValores = registro.valorAntes !== undefined && registro.valorDepois !== undefined;
  const mostrarLinhaValor = temValores && !ACOES_SEM_LINHA_DE_VALOR.includes(registro.acao);
  const nomeJaNoTitulo = ACOES_COM_NOME_NO_TITULO.includes(registro.acao);
  // Pra ações sem título dedicado que ainda assim têm um alvo de usuário,
  // mantém a linha "em Fulano" de reserva (não perde a informação).
  const mostrarLinhaAlvoReserva = mostrarAlvo && !nomeJaNoTitulo;

  return (
    <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-coffee-800">
          <TituloRegistro registro={registro} alvo={alvo} mostrarNomeNoTitulo={mostrarAlvo && nomeJaNoTitulo} />
        </p>
        <p className="flex-shrink-0 text-[11px] text-coffee-300">{dataFormatada}</p>
      </div>

      <p className="mt-1 text-xs text-coffee-500">
        por <span className="font-medium text-coffee-700">{registro.adminNome || 'admin'}</span>
        {mostrarLinhaAlvoReserva && (
          <>
            {' '}
            em{' '}
            <Link
              href={`/u/${alvo.username || registro.alvoId}`}
              className="font-medium text-coffee-700 hover:underline"
            >
              {alvo.nome}
            </Link>
          </>
        )}
      </p>

      {mostrarLinhaValor && (
        <p className="mt-1 text-xs text-coffee-500">
          {formatarValor(registro.valorAntes)} →{' '}
          <span className="font-semibold text-coffee-700">{formatarValor(registro.valorDepois)}</span>
        </p>
      )}

      {registro.detalhes && registro.acao === 'ajustar_pontos' && (
        <p className="mt-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-coffee-600">{registro.detalhes}</p>
      )}
    </div>
  );
}

// Deixa qualquer valor seguro pra exibir como texto — nunca renderiza um
// objeto direto (isso é o que quebrava a tela quando um registro antigo
// tinha valorAntes/valorDepois salvos como objeto; ver BUGFIX em
// lib/appConfig.js -> salvarConfiguracoesApp).
function formatarValor(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
