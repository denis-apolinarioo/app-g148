// ============================================================================
// PACOTE 2, item 2.3 — envia o código de recuperação de PIN por e-mail.
// ----------------------------------------------------------------------------
// Rota própria do Next.js (App Router) — deploya sozinha no mesmo
// `git push`/arraste do zip, sem nenhuma configuração extra no Firebase.
//
// Envio feito via Gmail (SMTP), usando lib/mailer.js. PRECISA DE DUAS
// VARIÁVEIS DE AMBIENTE NA VERCEL (ação manual — ver aviso no início da
// resposta): GMAIL_USER e GMAIL_APP_PASSWORD. Sem elas, esta rota responde
// 500 e a tela de recuperação mostra "não foi possível enviar".
//
// O código em si é gerado no aparelho da pessoa (lib/dracma.js) — esta rota
// só recebe o e-mail de destino, o nome e o código já prontos, e manda o
// e-mail. Nunca fica salvo em nenhum log do servidor.
// ============================================================================
import { NextResponse } from 'next/server';
import { getTransporter, remetentePadrao, origemValida } from '@/lib/mailer';

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

  const { email, nome, codigo } = body || {};
  if (!email || !codigo || !/^\d{6}$/.test(codigo)) {
    return NextResponse.json({ erro: 'DADOS_INVALIDOS' }, { status: 400 });
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.error('[recuperar-pin] GMAIL_USER/GMAIL_APP_PASSWORD não configuradas nas variáveis de ambiente.');
    return NextResponse.json({ erro: 'SERVICO_NAO_CONFIGURADO' }, { status: 500 });
  }

  const primeiroNome = (nome || '').trim().split(' ')[0] || 'você';

  try {
    await transporter.sendMail({
      from: remetentePadrao(),
      to: email,
      subject: 'Seu código para recuperar o PIN da Carteira — G148',
      html: `
        <div style="font-family: sans-serif; max-width: 420px; margin: 0 auto;">
          <p>Oi, ${primeiroNome}!</p>
          <p>Alguém (esperamos que você) pediu pra recuperar o PIN da sua Carteira no app G148.</p>
          <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px; margin: 24px 0;">${codigo}</p>
          <p>Esse código vale por 10 minutos. Se você não pediu essa recuperação, pode ignorar este e-mail.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[recuperar-pin] Erro ao enviar e-mail via Gmail:', err);
    return NextResponse.json({ erro: 'FALHA_ENVIO' }, { status: 502 });
  }
}
