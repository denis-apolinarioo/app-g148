// ============================================================================
// PACOTE 3, item 3.3 — envia o código de confirmação por e-mail, 2º dos 3
// fatores exigidos pra zerar Pontos ou Dracma de todo mundo (pop up ->
// e-mail -> senha do admin).
//
// Envio feito via Gmail (SMTP), usando lib/mailer.js — mesmo helper e mesmas
// variáveis de ambiente de app/api/recuperar-pin/route.js (GMAIL_USER e
// GMAIL_APP_PASSWORD, ação manual já explicada nessa outra rota).
//
// O código em si é gerado no aparelho do admin (componente do painel) —
// esta rota só recebe o e-mail de destino, o nome, o código pronto e qual
// ação está sendo confirmada, e manda o e-mail. Nunca fica salvo em nenhum
// log do servidor.
// ============================================================================
import { NextResponse } from 'next/server';
import { getTransporter, remetentePadrao, origemValida } from '@/lib/mailer';

const ROTULO_ACAO = {
  pontos: 'zerar os Pontos de Comunhão de TODOS os usuários',
  dracmas: 'zerar os Dracmas de TODOS os usuários',
};

export async function POST(request) {
  if (!origemValida(request)) {
    return NextResponse.json({ erro: 'ORIGEM_INVALIDA' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ erro: 'CORPO_INVALIDO' }, { status: 400 });
  }

  const { email, nome, codigo, acao } = body || {};
  if (!email || !codigo || !/^\d{6}$/.test(codigo)) {
    return NextResponse.json({ erro: 'DADOS_INVALIDOS' }, { status: 400 });
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.error('[confirmar-reset] GMAIL_USER/GMAIL_APP_PASSWORD não configuradas nas variáveis de ambiente.');
    return NextResponse.json({ erro: 'SERVICO_NAO_CONFIGURADO' }, { status: 500 });
  }

  const primeiroNome = (nome || '').trim().split(' ')[0] || 'admin';
  const descricaoAcao = ROTULO_ACAO[acao] || 'realizar uma ação sensível no Painel Admin';

  try {
    await transporter.sendMail({
      from: remetentePadrao(),
      to: email,
      subject: 'Código de confirmação — ação sensível no Painel Admin — G148',
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <p>Oi, ${primeiroNome}!</p>
          <p>Alguém (esperamos que você) está tentando <strong>${descricaoAcao}</strong> no Painel Admin do app G148.</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 24px 0;">${codigo}</p>
          <p>Esse código vale por 10 minutos. Se você não pediu essa ação, não compartilhe esse código com ninguém.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[confirmar-reset] Erro ao enviar e-mail via Gmail:', err);
    return NextResponse.json({ erro: 'FALHA_ENVIO' }, { status: 502 });
  }
}
