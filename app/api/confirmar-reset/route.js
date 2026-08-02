// ============================================================================
// PACOTE 3, item 3.3 — envia o código de confirmação por e-mail, 2º dos 3
// fatores exigidos pra zerar Pontos ou Dracma de todo mundo (pop up ->
// e-mail -> senha do admin). Mesmo padrão de app/api/recuperar-pin/route.js
// (mesma variável de ambiente RESEND_API_KEY, já configurada nesse projeto
// — nenhuma configuração manual nova é necessária).
//
// O código em si é gerado no aparelho do admin (componente do painel) —
// esta rota só recebe o e-mail de destino, o nome, o código pronto e qual
// ação está sendo confirmada, e manda o e-mail. Nunca fica salvo em nenhum
// log do servidor.
// ============================================================================
import { NextResponse } from 'next/server';

const REMETENTE_PADRAO = 'G148 <onboarding@resend.dev>';

const ROTULO_ACAO = {
  pontos: 'zerar os Pontos de Comunhão de TODOS os usuários',
  dracmas: 'zerar os Dracmas de TODOS os usuários',
};

export async function POST(request) {
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[confirmar-reset] RESEND_API_KEY não configurada nas variáveis de ambiente.');
    return NextResponse.json({ erro: 'SERVICO_NAO_CONFIGURADO' }, { status: 500 });
  }

  const primeiroNome = (nome || '').trim().split(' ')[0] || 'admin';
  const descricaoAcao = ROTULO_ACAO[acao] || 'realizar uma ação sensível no Painel Admin';

  try {
    const resposta = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || REMETENTE_PADRAO,
        to: [email],
        subject: 'Código de confirmação — ação sensível no Painel Admin — G148',
        html: `
          <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
            <p>Oi, ${primeiroNome}!</p>
            <p>Alguém (esperamos que você) está tentando <strong>${descricaoAcao}</strong> no Painel Admin do app G148.</p>
            <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 24px 0;">${codigo}</p>
            <p>Esse código vale por 10 minutos. Se você não pediu essa ação, não compartilhe esse código com ninguém.</p>
          </div>
        `,
      }),
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      console.error('[confirmar-reset] Resend retornou erro:', resposta.status, detalhe);
      return NextResponse.json({ erro: 'FALHA_ENVIO' }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[confirmar-reset] Erro ao chamar a API de e-mail:', err);
    return NextResponse.json({ erro: 'FALHA_ENVIO' }, { status: 502 });
  }
}
