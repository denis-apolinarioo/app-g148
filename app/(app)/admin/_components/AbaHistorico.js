'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { History, Search } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { useUsuarioAtual } from '@/lib/useUsuarioAtual';
import { subscribeToAcoesAdmin, buscarAcoesAdminPorUsuario } from '@/lib/adminLog';
import { getAllUsers } from '@/lib/firestore-helpers';
import { formatDateTimeBR } from '@/lib/dateUtils';

// Item 9º do Bloco 3 — tela de histórico das ações do admin (por enquanto,
// só o ajuste manual de pontos usa isso — ver AbaUsuarios.js / lib/points.js
// -> ajustarPontosManualmente — mas qualquer ação futura que chamar
// registrarAcaoAdmin() já aparece aqui de graça).
const ROTULOS_ACAO = {
  ajustar_pontos: 'Ajuste manual de pontos',
  editar_configuracoes_app: 'Configuração alterada',
};

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
        descricao="Ações administrativas (como ajuste manual de pontos) aparecem aqui."
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
// Aba "Buscar por pessoa" — digita um nome, escolhe a pessoa, vê só os
// ajustes de pontos feitos nela.
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

        <p className="text-sm font-semibold text-coffee-800">{selecionado.nome}</p>

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
            titulo="Nenhum ajuste encontrado"
            descricao="Essa pessoa ainda não teve pontos alterados manualmente."
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

  const termoBusca = busca.trim().toLowerCase();
  const usuariosFiltrados =
    termoBusca === '' ? [] : (usuarios || []).filter((u) => u.nome?.toLowerCase().includes(termoBusca));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-coffee-100 bg-cream-card px-3 py-2.5">
        <Search size={15} className="flex-shrink-0 text-coffee-300" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar pelo nome..."
          className="w-full bg-transparent text-sm text-coffee-800 outline-none placeholder:text-coffee-300"
        />
      </div>

      {usuarios === null && <div className="h-16 animate-pulse rounded-xl2 bg-coffee-100/60" />}

      {usuarios !== null && termoBusca === '' && (
        <p className="px-1 text-xs text-coffee-300">
          Digite um nome pra ver o histórico de pontos dessa pessoa.
        </p>
      )}

      {termoBusca !== '' && (
        <div className="space-y-1.5">
          {usuariosFiltrados.length === 0 && (
            <p className="px-1 text-xs text-coffee-300">Nenhum usuário encontrado.</p>
          )}
          {usuariosFiltrados.map((u) => (
            <button
              key={u.id}
              onClick={() => setSelecionado(u)}
              className="w-full rounded-xl border border-coffee-100 bg-cream-card px-3.5 py-2.5 text-left text-sm font-medium text-coffee-800"
            >
              {u.nome}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Uma linha de registro. `ocultarAlvo` é usado na aba "Buscar por pessoa"
// (já mostramos o nome dela no topo, então não repete "em Fulano" em cada
// linha).
//
// Blindagens adicionadas aqui (causa provável do erro de tela em branco ao
// abrir "Histórico"): `registro.createdAt` sendo tratado com segurança em
// todos os pontos (nunca passado direto pra formatação sem checar), e os
// campos numéricos/opcionais nunca presumidos como presentes.
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

  return (
    <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-coffee-800">
          {ROTULOS_ACAO[registro.acao] || registro.acao || 'Ação administrativa'}
        </p>
        <p className="flex-shrink-0 text-[11px] text-coffee-300">{dataFormatada}</p>
      </div>

      <p className="mt-1 text-xs text-coffee-500">
        por <span className="font-medium text-coffee-700">{registro.adminNome || 'admin'}</span>
        {mostrarAlvo && (
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

      {temValores && (
        <p className="mt-1 text-xs text-coffee-500">
          {formatarValor(registro.valorAntes)} →{' '}
          <span className="font-semibold text-coffee-700">{formatarValor(registro.valorDepois)}</span>
        </p>
      )}

      {registro.detalhes && (
        <p className="mt-1.5 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-coffee-600">{registro.detalhes}</p>
      )}
    </div>
  );
}
