'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/AuthProvider';
import TopBar from '@/components/TopBar';
import ToggleSwitch from '@/components/ToggleSwitch';
import LoadingScreen from '@/components/LoadingScreen';
import {
  ativarNotificacoes,
  desativarNotificacoes,
  detectarPlataforma,
  permissaoAtual,
  salvarPreferenciasNotificacao,
  salvarHorarioSilencio,
  CATEGORIAS_NOTIFICACAO,
} from '@/lib/push';
import { Bell, BellOff, Share, Loader2, AlertTriangle, Clock3 } from 'lucide-react';

const SILENCIO_PADRAO = { ativo: false, inicio: '22:00', fim: '07:00' };

export default function NotificacoesPage() {
  const { perfil } = useAuth();
  const [plataforma, setPlataforma] = useState({ ios: false, standalone: false, suportado: false });
  const [permissao, setPermissao] = useState('default');
  // Item novo — "ativado" agora é um estado PRÓPRIO, separado da permissão do
  // navegador. `permissao === 'granted'` só diz que o navegador autorizou
  // notificações algum dia; isso não significa que o token do FCM esteja
  // salvo no Firestore agora (ele pode nunca ter sido salvo, ou ter sido
  // apagado depois). Antes a tela usava `permissao === 'granted'` direto
  // pra decidir "Ativar" vs "Desativar", então: (1) quem já tinha aceitado
  // a permissão em algum momento passado via a tela sempre como "ativado"
  // sem o token nunca ter sido de fato registrado, e o push nunca chegava;
  // (2) apertar "Desativar" apagava o token certinho, mas a tela continuava
  // achando que estava ativado (permissão do navegador não muda por código),
  // então parecia que o botão não fazia nada.
  const [ativado, setAtivado] = useState(false);
  const [verificandoAoAbrir, setVerificandoAoAbrir] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [prefs, setPrefs] = useState({});
  const [silencio, setSilencio] = useState(SILENCIO_PADRAO);

  useEffect(() => {
    setPlataforma(detectarPlataforma());
    setPermissao(permissaoAtual());
  }, []);

  // Ao abrir a tela, se o navegador já tinha concedido permissão antes (de
  // uma visita anterior), tenta confirmar/renovar o token agora — sem pedir
  // permissão de novo (o navegador não reexibe o popup quando já está
  // 'granted', então isso roda em silêncio). Se der certo, aí sim marca como
  // ativado de verdade. Se falhar, deixa a tela mostrar "Ativar" pra pessoa
  // tentar de novo manualmente e ver o erro.
  useEffect(() => {
    if (!perfil) return;
    const { ios, standalone, suportado } = detectarPlataforma();
    if (!suportado || (ios && !standalone)) return;
    if (permissaoAtual() !== 'granted') return;

    let cancelado = false;
    setVerificandoAoAbrir(true);
    ativarNotificacoes(perfil.uid)
      .then(() => {
        if (!cancelado) setAtivado(true);
      })
      .catch((err) => {
        console.error('Não foi possível confirmar o token de push ao abrir a tela:', err);
        if (!cancelado) setAtivado(false);
      })
      .finally(() => {
        if (!cancelado) setVerificandoAoAbrir(false);
      });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil?.uid]);

  // Item 23/26 — os campos vêm do perfil (já reativo via AuthProvider), só
  // espelha em estado local pra deixar os toggles/inputs controlados.
  useEffect(() => {
    if (!perfil) return;
    setPrefs(perfil.notifPrefs || {});
    setSilencio(perfil.notifQuietHours || SILENCIO_PADRAO);
  }, [perfil]);

  if (!perfil) return <LoadingScreen />;

  async function handleAtivar() {
    setErro('');
    setCarregando(true);
    try {
      await ativarNotificacoes(perfil.uid);
      setPermissao('granted');
      setAtivado(true);
    } catch (err) {
      if (err.message === 'IOS_PRECISA_INSTALAR' || err.message === 'NAO_SUPORTADO') {
        setErro(err.message);
      } else if (err.message === 'PERMISSAO_NEGADA') {
        setPermissao('denied');
      } else {
        console.error('Erro ao ativar notificações:', err);
        setErro('FALHOU');
      }
      setAtivado(false);
    } finally {
      setCarregando(false);
    }
  }

  async function handleDesativar() {
    setCarregando(true);
    try {
      await desativarNotificacoes();
      setPermissao(permissaoAtual());
      setAtivado(false);
    } finally {
      setCarregando(false);
    }
  }

  async function handleTogglePref(chave, valor) {
    const novo = { ...prefs, [chave]: valor };
    setPrefs(novo);
    try {
      await salvarPreferenciasNotificacao(perfil.uid, novo);
    } catch (err) {
      console.error('Erro ao salvar preferência de notificação:', err);
    }
  }

  async function handleAtualizarSilencio(novo) {
    setSilencio(novo);
    try {
      await salvarHorarioSilencio(perfil.uid, novo);
    } catch (err) {
      console.error('Erro ao salvar horário de silêncio:', err);
    }
  }

  const jaAtivado = ativado;
  const iosSemInstalar = plataforma.ios && !plataforma.standalone;

  return (
    <div className="mx-auto max-w-md">
      <TopBar titulo="Notificações" voltarPara="/perfil/editar" />

      <div className="space-y-6 px-5 py-5">
        {/* Item 19 — iPhone só recebe push com o app instalado na Tela de Início */}
        {iosSemInstalar && (
          <div className="flex gap-3 rounded-xl border border-gold/40 bg-gold/10 p-3.5 text-sm text-coffee-700">
            <Share size={18} className="mt-0.5 shrink-0 text-gold" />
            <p>
              No iPhone, notificações só funcionam com o app instalado na Tela de Início. Toque no
              botão <strong>Compartilhar</strong> do Safari e depois em{' '}
              <strong>Adicionar à Tela de Início</strong>. Depois abra o app por esse ícone e volte
              aqui pra ativar.
            </p>
          </div>
        )}

        {!plataforma.suportado && !iosSemInstalar && (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p>Este navegador ou aparelho não é compatível com notificações push.</p>
          </div>
        )}

        <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-coffee-50">
              {jaAtivado ? (
                <Bell size={20} className="text-coffee-700" />
              ) : (
                <BellOff size={20} className="text-coffee-400" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-coffee-800">
                {jaAtivado ? 'Notificações ativadas' : 'Notificações desativadas'}
              </p>
              <p className="text-xs text-coffee-400">
                {permissao === 'denied'
                  ? 'Bloqueadas nas configurações do navegador'
                  : 'Avisos de mensagens, curtidas e comentários'}
              </p>
            </div>
          </div>

          {permissao === 'denied' ? (
            <p className="mt-3 text-xs text-coffee-400">
              Você bloqueou as notificações antes. Pra reativar, precisa liberar de novo direto nas
              configurações do site, no navegador do aparelho.
            </p>
          ) : (
            <button
              onClick={jaAtivado ? handleDesativar : handleAtivar}
              disabled={carregando || verificandoAoAbrir || !plataforma.suportado || iosSemInstalar}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-coffee-700 py-2.5 text-sm font-semibold text-cream disabled:opacity-40"
            >
              {(carregando || verificandoAoAbrir) && <Loader2 size={15} className="animate-spin" />}
              {verificandoAoAbrir ? 'Confirmando...' : jaAtivado ? 'Desativar notificações' : 'Ativar notificações'}
            </button>
          )}

          {erro === 'NAO_SUPORTADO' && (
            <p className="mt-2 text-xs text-red-600">Este aparelho não suporta notificações push.</p>
          )}
          {erro === 'FALHOU' && (
            <p className="mt-2 text-xs text-red-600">Não deu pra ativar agora. Tenta de novo em instantes.</p>
          )}
        </div>

        {/* Item 23 — preferências por categoria */}
        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-coffee-400">
            O que você quer receber
          </h2>
          <div className="divide-y divide-coffee-100 rounded-2xl border border-coffee-100 bg-cream-card">
            {CATEGORIAS_NOTIFICACAO.map((cat) => (
              <div key={cat.chave} className="flex items-center justify-between px-4 py-3.5">
                <span className="text-sm text-coffee-700">{cat.label}</span>
                <ToggleSwitch
                  ativo={prefs[cat.chave] !== false}
                  onChange={(v) => handleTogglePref(cat.chave, v)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Item 26 — horário de silêncio */}
        <div>
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee-400">
            <Clock3 size={13} /> Horário de silêncio
          </h2>
          <div className="rounded-2xl border border-coffee-100 bg-cream-card p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-coffee-700">Não notificar nesse período</span>
              <ToggleSwitch
                ativo={!!silencio.ativo}
                onChange={(v) => handleAtualizarSilencio({ ...silencio, ativo: v })}
              />
            </div>
            {silencio.ativo && (
              <div className="mt-3 flex items-center gap-3">
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-coffee-400">Início</span>
                  <input
                    type="time"
                    value={silencio.inicio}
                    onChange={(e) => handleAtualizarSilencio({ ...silencio, inicio: e.target.value })}
                    className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-700"
                  />
                </label>
                <label className="flex-1">
                  <span className="mb-1 block text-xs text-coffee-400">Fim</span>
                  <input
                    type="time"
                    value={silencio.fim}
                    onChange={(e) => handleAtualizarSilencio({ ...silencio, fim: e.target.value })}
                    className="w-full rounded-xl border border-coffee-100 bg-cream px-3 py-2 text-sm text-coffee-700"
                  />
                </label>
              </div>
            )}
            <p className="mt-2 text-xs text-coffee-400">
              O Correio continua recebendo tudo normalmente — só o aviso push fica em silêncio nesse
              horário.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
