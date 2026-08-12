'use client';

import { useEffect, useState } from 'react';
import { Lock, Unlock, Loader2, SlidersHorizontal, Search, X, UserCog, UserX } from 'lucide-react';
import DracmaIcon from '@/components/DracmaIcon';
import Avatar from '@/components/Avatar';
import ConfirmarAcaoModal from '@/components/ConfirmarAcaoModal';
import ConfirmarResetModal from '@/components/ConfirmarResetModal';
import { useAuth } from '@/components/AuthProvider';
import { useConfirm } from '@/components/ConfirmProvider';
import { subscribeToAllUsers, toggleTravarUsuario, updateUserProfile } from '@/lib/firestore-helpers';
import { ajustarPontosManualmente } from '@/lib/points';
import { ajustarDracmaManualmente, formatarDracma } from '@/lib/dracma';
import { combinaComBusca } from '@/lib/searchUtils';
import { subscribeATodasAsFuncoes } from '@/lib/funcoesRepo';
import { notificarGanhoPontos, notificarGanhoDracma } from '@/lib/notificacoes';
import { excluirConta } from '@/lib/excluirContaRepo';

// A migração que ativava o campo `dracmas` pra quem já estava cadastrado
// antes da 2ª moeda existir já rodou e não é mais necessária — o botão
// (ação de uma vez só, já usada) foi removido daqui.
export default function AbaUsuarios() {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const [usuarios, setUsuarios] = useState(null);
  const [busca, setBusca] = useState('');
  const [travandoId, setTravandoId] = useState(null);
  const [ajuste, setAjuste] = useState(null); // { usuario, tipo: 'pontos' | 'dracma' }

  // Excluir conta (LGPD) — mesma function do botão em Perfil → Editar,
  // agora pro Admin poder acionar em nome de qualquer pessoa (ver
  // excluirConta em functions/index.js pro que exatamente acontece).
  // Mesmas 3 camadas de confirmação da auto-exclusão em Perfil → Editar:
  // (1) aviso do que vai acontecer (ConfirmarAcaoModal); (2) código de
  // 6 dígitos por e-mail + senha (ou Google) da conta de quem está
  // confirmando (ConfirmarResetModal — o e-mail mostra o nome de quem
  // está sendo excluído, como checagem final antes de excluir a conta
  // errada); (3) só depois de tudo isso é que handleExcluirUsuario chama
  // a Cloud Function de verdade.
  const [excluindo, setExcluindo] = useState(null); // usuário sendo confirmado/excluído
  const [autenticandoExclusao, setAutenticandoExclusao] = useState(false);
  const [processandoExclusao, setProcessandoExclusao] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  // Troca de função (aba Funções) — o Admin pode mudar a de qualquer
  // pessoa daqui, além da própria pessoa poder trocar a sua quando quiser
  // pelo Editar Perfil (ver app/(app)/perfil/editar/page.js).
  const [funcoes, setFuncoes] = useState(null);
  const [trocandoFuncaoUid, setTrocandoFuncaoUid] = useState(null);
  const [salvandoFuncao, setSalvandoFuncao] = useState(false);

  // Escuta ao vivo (onSnapshot) em vez de buscar uma vez só — a lista de
  // usuários e as funções disponíveis refletem mudanças na hora, sem
  // sair-e-voltar (inclusive as atualizações otimistas locais abaixo, como
  // travar/destravar ou trocar função, continuam funcionando normalmente:
  // a escuta só confirma o mesmo resultado assim que o Firestore termina
  // de gravar).
  useEffect(() => {
    const unsubUsuarios = subscribeToAllUsers(setUsuarios);
    const unsubFuncoes = subscribeATodasAsFuncoes(setFuncoes);
    return () => {
      unsubUsuarios();
      unsubFuncoes();
    };
  }, []);

  // Troca a função de UM usuário específico. Deixa escolher entre TODAS as
  // funções (não só as ativas) — se o Admin já deixou a pessoa com uma
  // função que virou inativa depois, ele ainda precisa conseguir trocar
  // pra outra sem ficar travado.
  async function handleTrocarFuncao(uid, novaFuncao) {
    if (!novaFuncao || salvandoFuncao) return;
    setSalvandoFuncao(true);
    try {
      await updateUserProfile(uid, { tagFuncao: novaFuncao });
      setUsuarios((lista) => lista.map((u) => (u.id === uid ? { ...u, tagFuncao: novaFuncao } : u)));
      setTrocandoFuncaoUid(null);
    } catch (err) {
      console.error('Erro ao trocar função do usuário:', err);
    } finally {
      setSalvandoFuncao(false);
    }
  }

  // Item 13 do Bloco 6 — travar/destravar acesso, com confirmação (agora
  // usando o popup próprio do app em vez do confirm() feio do navegador).
  async function handleAlternarTravamento(usuario) {
    const travar = !usuario.travado;
    const ok = await confirmar({
      titulo: travar ? `Travar o acesso de ${usuario.nome}?` : `Destravar o acesso de ${usuario.nome}?`,
      descricao: travar
        ? 'Ela não vai conseguir mais usar o app até você destravar de novo — mesmo que já esteja logada.'
        : 'Ela vai poder usar o app normalmente de novo.',
      perigo: travar,
      labelConfirmar: travar ? 'Travar' : 'Destravar',
    });
    if (!ok) return;

    setTravandoId(usuario.id);
    try {
      await toggleTravarUsuario(usuario.id, travar, perfil);
      setUsuarios((lista) => lista.map((u) => (u.id === usuario.id ? { ...u, travado: travar } : u)));
    } catch (err) {
      console.error('Erro ao travar/destravar usuário:', err);
    } finally {
      setTravandoId(null);
    }
  }

  function aplicarNoUsuario(uid, patch) {
    setUsuarios((lista) => lista.map((u) => (u.id === uid ? { ...u, ...patch } : u)));
  }

  // Sempre entra pela 1ª camada (aviso), mesmo que o Admin já tenha
  // excluído outra pessoa antes na mesma sessão — sem isso, autenticandoExclusao
  // ficaria "true" de uma exclusão anterior e a próxima pularia direto pro
  // e-mail/senha sem passar pelo aviso de novo.
  function abrirExclusao(usuario) {
    setExcluindo(usuario);
    setAutenticandoExclusao(false);
    setErroExclusao('');
  }

  // Excluir conta (LGPD) — o Admin não pode excluir a PRÓPRIA conta por
  // aqui (evita acidente; se ele mesmo quiser sair do app de vez, usa o
  // botão em Perfil → Editar, que passa por outra confirmação, específica
  // dele). Ver excluirConta em lib/excluirContaRepo.js / functions/index.js.
  async function handleExcluirUsuario() {
    if (!excluindo || processandoExclusao) return;
    setProcessandoExclusao(true);
    setErroExclusao('');
    try {
      await excluirConta(excluindo.id);
      setUsuarios((lista) => lista.filter((u) => u.id !== excluindo.id));
      setExcluindo(null);
      setAutenticandoExclusao(false);
    } catch (err) {
      console.error('Erro ao excluir conta:', err);
      // Mostra a mensagem real que a Cloud Function mandou (ex.: "Falha ao
      // excluir conta na etapa X: ...") sempre que ela existir — antes esse
      // detalhe era jogado fora e o texto genérico aparecia até quando o
      // erro tinha uma causa clara. Só cai no texto genérico se realmente
      // não veio nenhuma mensagem útil (ex.: sem internet de verdade).
      const detalhe = err && typeof err.message === 'string' ? err.message.trim() : '';
      setErroExclusao(
        detalhe && detalhe.toLowerCase() !== 'internal'
          ? detalhe
          : 'Não foi possível excluir agora. Verifique sua internet e tente de novo.'
      );
    } finally {
      setProcessandoExclusao(false);
    }
  }

  if (!usuarios) return <div className="h-40 animate-pulse rounded-xl2 bg-coffee-100/60" />;

  const usuariosFiltrados = busca.trim()
    ? usuarios.filter((u) => combinaComBusca(u.nome, busca) || combinaComBusca(u.username, busca))
    : usuarios;

  return (
    <div className="space-y-2">
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
        {busca.trim()
          ? `${usuariosFiltrados.length} encontrado(s)`
          : `${usuarios.length} pessoas na comunidade`}
      </p>
      {busca.trim() && usuariosFiltrados.length === 0 && (
        <p className="px-1 text-xs text-coffee-300">Ninguém encontrado com esse nome ou @username.</p>
      )}

      {/* Pontos e Dracma não aparecem de cara aqui — só ao tocar num dos
          botões abaixo, que abrem o popup de ajuste com o valor certinho da
          pessoa. Evita a lista inteira virando um placar público de saldo. */}
      {usuariosFiltrados.map((u) => (
        <div
          key={u.id}
          className="rounded-xl2 border border-coffee-100 bg-cream-card px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2">
            <Avatar src={u.fotoURL} nome={u.nome} tamanho="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-coffee-800">{u.nome}</p>
              <p className="truncate text-xs text-coffee-300">
                @{u.username}
                {u.tagFuncao ? ` · ${u.tagFuncao}` : ''}
              </p>
            </div>
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
              onClick={() => setTrocandoFuncaoUid(trocandoFuncaoUid === u.id ? null : u.id)}
              aria-label={`Trocar função de ${u.nome}`}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:text-coffee-600"
            >
              <UserCog size={14} />
            </button>
            <button
              onClick={() => setAjuste({ usuario: u, tipo: 'pontos' })}
              aria-label={`Ajustar pontos de ${u.nome}`}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:text-coffee-600"
            >
              <SlidersHorizontal size={14} />
            </button>
            <button
              onClick={() => setAjuste({ usuario: u, tipo: 'dracma' })}
              aria-label={`Ajustar Dracma de ${u.nome}`}
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-coffee-300 hover:text-gold"
            >
              <DracmaIcon size={14} />
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
                u.travado ? 'border-red-200 bg-red-50 text-red-600' : 'border-coffee-100 text-coffee-400'
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
            {/* Excluir conta (LGPD) — não aparece pra própria conta do Admin
                logado (mesma trava do botão de travar acima; excluir a
                própria conta é só pelo botão em Perfil → Editar). */}
            {u.id !== perfil?.uid && (
              <button
                onClick={() => abrirExclusao(u)}
                title="Excluir conta"
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-coffee-100 text-coffee-400 hover:border-red-200 hover:text-red-600"
              >
                <UserX size={14} />
              </button>
            )}
          </div>

          {/* Seletor de função — abre embaixo da linha, entre TODAS as
              funções (não só ativas), pra nunca travar o Admin se a pessoa
              já estiver com uma função que virou inativa. */}
          {trocandoFuncaoUid === u.id && (
            <div className="mt-2.5 flex items-center gap-2 border-t border-coffee-100 pt-2.5">
              <select
                defaultValue={u.tagFuncao || ''}
                onChange={(e) => handleTrocarFuncao(u.id, e.target.value)}
                disabled={salvandoFuncao}
                className="flex-1 rounded-lg border border-coffee-100 bg-cream px-2.5 py-2 text-xs text-coffee-800 disabled:opacity-50"
              >
                {u.tagFuncao && !funcoes?.some((f) => f.nome === u.tagFuncao) && (
                  <option value={u.tagFuncao}>{u.tagFuncao}</option>
                )}
                {funcoes?.map((f) => (
                  <option key={f.id} value={f.nome}>
                    {f.nome}
                  </option>
                ))}
              </select>
              {salvandoFuncao && <Loader2 size={14} className="animate-spin text-coffee-400" />}
            </div>
          )}
        </div>
      ))}

      <p className="pt-3 text-xs text-coffee-300">
        Pra tornar alguém admin, é preciso editar diretamente no Firestore (coleção{' '}
        <code>users</code>, campo <code>isAdmin</code> → <code>true</code>) — uma trava extra de
        segurança pra esse tipo de permissão sensível.
      </p>

      {ajuste && (
        <AjustePopup
          usuario={ajuste.usuario}
          tipo={ajuste.tipo}
          onFechar={() => setAjuste(null)}
          onAplicado={(patch) => aplicarNoUsuario(ajuste.usuario.id, patch)}
        />
      )}

      {excluindo && !autenticandoExclusao && (
        <ConfirmarAcaoModal
          titulo={`Excluir a conta de ${excluindo.nome}?`}
          mensagem={`O perfil, a carteira e as conquistas de ${excluindo.nome} somem de vez, e ela é desconectada do app na hora. Os posts, comentários e pedidos de oração que ela já fez continuam no app, mas aparecem como "Usuário removido". Essa ação não pode ser desfeita.`}
          textoConfirmar="Continuar"
          onFechar={() => setExcluindo(null)}
          onConfirmar={() => setAutenticandoExclusao(true)}
        />
      )}

      {/* 2ª camada, mesmo padrão da auto-exclusão em Perfil → Editar: código
          de 6 dígitos por e-mail (pro e-mail de quem está confirmando, o
          Admin logado — não pra pessoa sendo excluída) seguido da senha
          (ou Google) da própria conta. O e-mail mostra o nome de quem vai
          ser excluído, como última checagem antes de excluir a conta
          errada. Só depois de tudo isso handleExcluirUsuario chama a
          Cloud Function de verdade. */}
      {excluindo && autenticandoExclusao && (
        <ConfirmarResetModal
          acao="excluir_conta_admin"
          alvo={excluindo.nome}
          titulo="Excluir conta de outro usuário"
          descricao={`Última etapa: confirme o código enviado por e-mail e depois sua senha pra excluir a conta de ${excluindo.nome} de vez. Essa ação não pode ser desfeita.`}
          onFechar={() => {
            if (!processandoExclusao) {
              setAutenticandoExclusao(false);
              setExcluindo(null);
              setErroExclusao('');
            }
          }}
          onConfirmado={handleExcluirUsuario}
        />
      )}

      {/* Erro (se houver) fica por cima dos modais acima — nenhum dos dois
          tem slot próprio pra isso, então mostramos como um toast simples
          ancorado embaixo, sem fechar o popup em aberto. */}
      {excluindo && erroExclusao && (
        <div className="fixed inset-x-0 bottom-24 z-[60] mx-auto w-fit max-w-xs rounded-xl bg-red-700 px-4 py-2.5 text-center text-xs font-medium text-texto-forte shadow-lg">
          {erroExclusao}
        </div>
      )}
    </div>
  );
}

function Campo({ label, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-coffee-500">{label}</label>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Popup de ajuste manual de pontos/Dracma — pedido do Admin: editar sempre
// por popup, sem mostrar o saldo de cara na lista (só aparece aqui, ao abrir
// o ajuste de uma pessoa específica); os botões "Adicionar"/"Remover" já
// vêm pré-definidos (a pessoa não precisa lembrar de digitar um número
// negativo pra remover); o "Aplicar" pede uma confirmação simples antes de
// gravar (ver components/ConfirmProvider.js).
// ----------------------------------------------------------------------------
function AjustePopup({ usuario, tipo, onFechar, onAplicado }) {
  const { perfil } = useAuth();
  const confirmar = useConfirm();
  const ehPontos = tipo === 'pontos';

  const [operacao, setOperacao] = useState('somar'); // 'somar' | 'remover'
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const rotulo = ehPontos ? 'Pontos de Comunhão' : 'Dracma';
  const valorAtual = ehPontos ? usuario.pontos || 0 : usuario.dracmas || 0;
  const valorAtualFormatado = ehPontos ? valorAtual : formatarDracma(valorAtual);

  async function handleAplicar() {
    const numero = Number(valor);
    if (!numero || Number.isNaN(numero) || numero <= 0) {
      setErro('Informe uma quantidade maior que zero.');
      return;
    }
    const delta = operacao === 'somar' ? numero : -numero;
    const verbo = operacao === 'somar' ? 'Adicionar' : 'Remover';
    const preposicao = operacao === 'somar' ? 'para' : 'de';

    const ok = await confirmar({
      titulo: `${verbo} ${numero} ${rotulo.toLowerCase()} ${preposicao} ${usuario.nome}?`,
      descricao: motivo.trim() ? `Motivo: ${motivo.trim()}` : 'Nenhum motivo informado.',
      labelConfirmar: 'Aplicar',
      perigo: operacao === 'remover',
    });
    if (!ok) return;

    setSalvando(true);
    setErro('');
    try {
      const depois = ehPontos
        ? await ajustarPontosManualmente(usuario.id, delta, perfil, motivo.trim())
        : await ajustarDracmaManualmente(usuario.id, delta, perfil, motivo.trim());
      // Notifica só em GANHOS (delta > 0) — as funções abaixo já ignoram
      // sozinhas valores <= 0, então não precisa de "if" aqui. Não usa
      // await de propósito: se a notificação falhar (ex.: sem internet no
      // exato instante), o ajuste em si (que já foi salvo acima) não deve
      // ficar pendurado esperando por isso.
      if (ehPontos) {
        notificarGanhoPontos(usuario.id, perfil, delta);
      } else {
        notificarGanhoDracma(usuario.id, perfil, delta);
      }
      onAplicado(ehPontos ? { pontos: depois } : { dracmas: depois });
      onFechar();
    } catch (err) {
      console.error('Erro ao ajustar manualmente:', err);
      setErro('Não foi possível salvar o ajuste. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-forte-900/40 sm:items-center"
      onClick={onFechar}
    >
      <div
        className="w-full max-w-sm overflow-y-auto rounded-t-2xl bg-cream sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-coffee-100 px-5 py-4">
          <h3 className="font-destaque text-base font-semibold text-coffee-800">Ajustar {rotulo}</h3>
          <button onClick={onFechar} className="text-coffee-400">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar src={usuario.fotoURL} nome={usuario.nome} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-coffee-800">{usuario.nome}</p>
              <p className="text-xs text-coffee-400">
                saldo atual: <span className="font-semibold text-coffee-700">{valorAtualFormatado}</span>
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOperacao('somar')}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                operacao === 'somar'
                  ? 'border-forte bg-forte text-texto-forte'
                  : 'border-coffee-200 text-coffee-600'
              }`}
            >
              + Adicionar
            </button>
            <button
              type="button"
              onClick={() => setOperacao('remover')}
              className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                operacao === 'remover'
                  ? 'border-red-600 bg-red-600 text-texto-forte'
                  : 'border-coffee-200 text-coffee-600'
              }`}
            >
              − Remover
            </button>
          </div>

          <Campo label="Quantidade">
            <input
              type="number"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          <Campo label="Motivo (opcional)">
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: bônus por ajudar na organização do evento"
              className="w-full rounded-lg border border-coffee-100 bg-cream-card px-3 py-2.5 text-sm text-coffee-800"
            />
          </Campo>

          {erro && <p className="text-sm text-red-700">{erro}</p>}

          <button
            onClick={handleAplicar}
            disabled={!valor || salvando}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-forte py-3 text-sm font-semibold text-texto-forte disabled:opacity-40"
          >
            {salvando && <Loader2 size={14} className="animate-spin" />}
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
