'use client';

import { useEffect, useState } from 'react';
import { Lock, Unlock, Loader2, SlidersHorizontal, Search, UploadCloud, Coins } from 'lucide-react';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import { getAllUsers, toggleTravarUsuario, migrarDracmasDosUsuarios } from '@/lib/firestore-helpers';
import { ajustarPontosManualmente } from '@/lib/points';
import { ajustarDracmaManualmente } from '@/lib/dracma';
import { combinaComBusca } from '@/lib/searchUtils';

export default function AbaUsuarios() {
  const { perfil } = useAuth();
  const [usuarios, setUsuarios] = useState(null);
  const [busca, setBusca] = useState('');
  const [travandoId, setTravandoId] = useState(null);
  const [ajustandoUid, setAjustandoUid] = useState(null);
  const [valorAjuste, setValorAjuste] = useState('');
  const [motivoAjuste, setMotivoAjuste] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [migrandoDracmas, setMigrandoDracmas] = useState(false);
  const [resultadoMigracaoDracmas, setResultadoMigracaoDracmas] = useState(null);

  // PACOTE 2 — ajuste manual de Dracma, mesmo padrão do ajuste de pontos
  // acima, só que com estado próprio (são dois formulários independentes,
  // podem ficar abertos ao mesmo tempo para pessoas diferentes).
  const [ajustandoDracmaUid, setAjustandoDracmaUid] = useState(null);
  const [valorAjusteDracma, setValorAjusteDracma] = useState('');
  const [motivoAjusteDracma, setMotivoAjusteDracma] = useState('');
  const [salvandoDracma, setSalvandoDracma] = useState(false);
  const [erroDracma, setErroDracma] = useState('');

  useEffect(() => {
    getAllUsers().then(setUsuarios);
  }, []);

  // PACOTE 1 (2 moedas) — garante que todo mundo já cadastrado tenha o
  // campo `dracmas` (segura pra clicar mais de uma vez).
  async function handleMigrarDracmas() {
    if (migrandoDracmas) return;
    setMigrandoDracmas(true);
    setResultadoMigracaoDracmas(null);
    try {
      const migrados = await migrarDracmasDosUsuarios();
      setResultadoMigracaoDracmas(
        migrados > 0
          ? `${migrados} pessoa(s) com Dracma ativado.`
          : 'Nada pra migrar — todo mundo já tem Dracma.'
      );
      getAllUsers().then(setUsuarios);
    } catch (err) {
      console.error('Erro ao migrar dracmas dos usuários:', err);
      setResultadoMigracaoDracmas('Não foi possível migrar agora. Tente de novo em instantes.');
    } finally {
      setMigrandoDracmas(false);
    }
  }

  // Item 13 do Bloco 6 — travar/destravar acesso, com confirmação.
  async function handleAlternarTravamento(usuario) {
    const travar = !usuario.travado;
    const pergunta = travar
      ? `Travar o acesso de ${usuario.nome}? Ela não vai conseguir mais usar o app até você destravar de novo — mesmo que já esteja logada.`
      : `Destravar o acesso de ${usuario.nome}? Ela vai poder usar o app normalmente de novo.`;
    if (!confirm(pergunta)) return;

    setTravandoId(usuario.id);
    try {
      await toggleTravarUsuario(usuario.id, travar, perfil);
      setUsuarios((lista) =>
        lista.map((u) => (u.id === usuario.id ? { ...u, travado: travar } : u))
      );
    } catch (err) {
      console.error('Erro ao travar/destravar usuário:', err);
    } finally {
      setTravandoId(null);
    }
  }

  function abrirAjuste(uid) {
    setAjustandoUid(uid === ajustandoUid ? null : uid);
    setValorAjuste('');
    setMotivoAjuste('');
    setErro('');
  }

  // 8º — ajuste manual de pontos, com auditoria automática (adminActionsLog,
  // ver lib/points.js -> ajustarPontosManualmente).
  async function handleAjustar(uid) {
    const numero = Number(valorAjuste);
    if (!numero || Number.isNaN(numero)) {
      setErro('Informe um número diferente de zero (positivo soma, negativo remove).');
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const pontosDepois = await ajustarPontosManualmente(uid, numero, perfil, motivoAjuste.trim());
      setUsuarios((lista) => lista.map((u) => (u.id === uid ? { ...u, pontos: pontosDepois } : u)));
      setAjustandoUid(null);
      setValorAjuste('');
      setMotivoAjuste('');
    } catch (err) {
      console.error('Erro ao ajustar pontos manualmente:', err);
      setErro('Não foi possível salvar o ajuste. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirAjusteDracma(uid) {
    setAjustandoDracmaUid(uid === ajustandoDracmaUid ? null : uid);
    setValorAjusteDracma('');
    setMotivoAjusteDracma('');
    setErroDracma('');
  }

  // PACOTE 2 — ajuste manual de Dracma, com auditoria automática
  // (adminActionsLog + dracmaLog, ver lib/dracma.js -> ajustarDracmaManualmente).
  async function handleAjustarDracma(uid) {
    const numero = Number(valorAjusteDracma);
    if (!numero || Number.isNaN(numero)) {
      setErroDracma('Informe um número diferente de zero (positivo soma, negativo remove).');
      return;
    }
    setSalvandoDracma(true);
    setErroDracma('');
    try {
      const dracmasDepois = await ajustarDracmaManualmente(uid, numero, perfil, motivoAjusteDracma.trim());
      setUsuarios((lista) => lista.map((u) => (u.id === uid ? { ...u, dracmas: dracmasDepois } : u)));
      setAjustandoDracmaUid(null);
      setValorAjusteDracma('');
      setMotivoAjusteDracma('');
    } catch (err) {
      console.error('Erro ao ajustar Dracma manualmente:', err);
      setErroDracma('Não foi possível salvar o ajuste. Tente de novo.');
    } finally {
      setSalvandoDracma(false);
    }
  }

  if (!usuarios) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  const usuariosFiltrados = busca.trim()
    ? usuarios.filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca))
    : usuarios;

  return (
    <div className="space-y-2">
      <div className="rounded-xl2 border border-coffee-100 bg-cream-card p-4">
        <p className="text-xs text-coffee-500">
          Ativa a 2ª moeda (Dracma) pra quem já estava cadastrado antes dela existir. É seguro
          clicar mais de uma vez — só mexe em quem ainda não tem o campo.
        </p>
        <button
          onClick={handleMigrarDracmas}
          disabled={migrandoDracmas}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-coffee-200 py-2.5 text-sm font-semibold text-coffee-700 disabled:opacity-40"
        >
          {migrandoDracmas ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <UploadCloud size={14} />
          )}
          Ativar Dracma pra quem já estava cadastrado
        </button>
        {resultadoMigracaoDracmas && (
          <p className="mt-2 text-center text-xs text-coffee-500">{resultadoMigracaoDracmas}</p>
        )}
      </div>

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

      <p className="mb-2 text-xs text-coffee-400">
        {busca.trim() ? `${usuariosFiltrados.length} encontrado(s)` : `${usuarios.length} pessoas na comunidade`}
      </p>
      {busca.trim() && usuariosFiltrados.length === 0 && (
        <p className="px-1 text-xs text-coffee-300">Ninguém encontrado com esse nome ou @username.</p>
      )}
      {usuariosFiltrados.map((u) => (
        <div
          key={u.id}
          className="rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
        >
          <div className="flex items-center gap-3">
            <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
              <p className="text-xs text-coffee-300">@{u.username}</p>
            </div>
            <span className="font-destaque text-sm font-bold text-coffee-600">{u.pontos || 0}</span>
            <span className="flex items-center gap-1 font-destaque text-sm font-bold text-gold">
              <Coins size={13} /> {u.dracmas || 0}
            </span>
            {u.isAdmin && (
              <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold">
                admin
              </span>
            )}
            {u.travado && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                travado
              </span>
            )}
            <button
              onClick={() => abrirAjuste(u.id)}
              aria-label="Ajustar pontos manualmente"
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                ajustandoUid === u.id ? 'bg-coffee-700 text-cream' : 'text-coffee-300 hover:text-coffee-600'
              }`}
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => abrirAjusteDracma(u.id)}
              aria-label="Ajustar Dracma manualmente"
              className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ${
                ajustandoDracmaUid === u.id ? 'bg-gold text-cream' : 'text-coffee-300 hover:text-gold'
              }`}
            >
              <Coins size={14} />
            </button>
            <button
              onClick={() => handleAlternarTravamento(u)}
              disabled={travandoId === u.id || u.id === perfil?.uid}
              title={
                u.id === perfil?.uid
                  ? 'Não é possível travar a própria conta'
                  : u.travado
                    ? 'Destravar acesso'
                    : 'Travar acesso'
              }
              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border disabled:opacity-40 ${
                u.travado
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-coffee-100 text-coffee-400'
              }`}
            >
              {travandoId === u.id ? (
                <Loader2 size={14} className="animate-spin" />
              ) : u.travado ? (
                <Unlock size={14} />
              ) : (
                <Lock size={14} />
              )}
            </button>
          </div>

          {ajustandoUid === u.id && (
            <div className="mt-2.5 space-y-2 border-t border-coffee-100 pt-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={valorAjuste}
                  onChange={(e) => setValorAjuste(e.target.value)}
                  placeholder="ex.: 10 ou -10"
                  className="w-28 rounded-lg border border-coffee-100 bg-cream px-2.5 py-1.5 text-sm text-coffee-800"
                />
                <input
                  type="text"
                  value={motivoAjuste}
                  onChange={(e) => setMotivoAjuste(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="flex-1 rounded-lg border border-coffee-100 bg-cream px-2.5 py-1.5 text-sm text-coffee-800"
                />
                <button
                  onClick={() => handleAjustar(u.id)}
                  disabled={salvando}
                  className="flex h-8 flex-shrink-0 items-center justify-center rounded-lg bg-coffee-700 px-3 text-xs font-semibold text-cream disabled:opacity-50"
                >
                  {salvando ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {erro && <p className="text-xs text-red-600">{erro}</p>}
            </div>
          )}

          {ajustandoDracmaUid === u.id && (
            <div className="mt-2.5 space-y-2 border-t border-coffee-100 pt-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={valorAjusteDracma}
                  onChange={(e) => setValorAjusteDracma(e.target.value)}
                  placeholder="ex.: 10 ou -10"
                  className="w-28 rounded-lg border border-coffee-100 bg-cream px-2.5 py-1.5 text-sm text-coffee-800"
                />
                <input
                  type="text"
                  value={motivoAjusteDracma}
                  onChange={(e) => setMotivoAjusteDracma(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="flex-1 rounded-lg border border-coffee-100 bg-cream px-2.5 py-1.5 text-sm text-coffee-800"
                />
                <button
                  onClick={() => handleAjustarDracma(u.id)}
                  disabled={salvandoDracma}
                  className="flex h-8 flex-shrink-0 items-center justify-center rounded-lg bg-gold px-3 text-xs font-semibold text-cream disabled:opacity-50"
                >
                  {salvandoDracma ? <Loader2 size={14} className="animate-spin" /> : 'Aplicar'}
                </button>
              </div>
              {erroDracma && <p className="text-xs text-red-600">{erroDracma}</p>}
            </div>
          )}
        </div>
      ))}
      <p className="pt-3 text-xs text-coffee-300">
        Pra tornar alguém admin, é preciso editar diretamente no Firestore (coleção{' '}
        <code>users</code>, campo <code>isAdmin</code> → <code>true</code>) — uma trava extra de
        segurança pra esse tipo de permissão sensível.
      </p>
    </div>
  );
}
