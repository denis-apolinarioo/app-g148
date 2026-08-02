// ============================================================================
// Envio de e-mail via Gmail (SMTP), usando a biblioteca nodemailer.
// ----------------------------------------------------------------------------
// PRECISA DE DUAS VARIÁVEIS DE AMBIENTE NA VERCEL (ação manual — ver aviso
// no início da resposta):
//   GMAIL_USER          -> o e-mail do Gmail que vai mandar as mensagens
//   GMAIL_APP_PASSWORD  -> a "Senha de app" gerada nas configurações da
//                          conta Google (não é a senha normal de login)
//
// Sem essas duas variáveis, as rotas que usam este helper respondem 500 e
// a tela correspondente mostra "não foi possível enviar".
//
// Usado por app/api/recuperar-pin/route.js e app/api/confirmar-reset/route.js.
// ============================================================================
import nodemailer from 'nodemailer';

let transporterCache = null;

export function getTransporter() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporterCache) {
    transporterCache = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });
  }
  return transporterCache;
}

export function remetentePadrao() {
  const user = process.env.GMAIL_USER || '';
  return `G148 <${user}>`;
}
