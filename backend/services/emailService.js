const nodemailer = require('nodemailer');

let transporter = null;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10) || 587,
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    });
  }
  return transporter;
}

const TEMPLATES = {
  nova_solicitacao: (s) => ({
    assunto: `Nova solicitação de licitação para aprovação: ${s.numero_protocolo}`,
    html: `<p>Uma nova solicitação (<b>${s.numero_protocolo}</b>) foi enviada para aprovação.</p>
           <p><b>Órgão:</b> ${s.orgao || '-'}<br/>
           <b>Edital:</b> ${s.edital_numero || '-'}<br/>
           <b>Valor estimado:</b> R$ ${s.valor_estimado || '0,00'}</p>`
  }),
  mudanca_status: (s) => ({
    assunto: `Atualização da solicitação ${s.numero_protocolo}: ${s.status}`,
    html: `<p>A solicitação <b>${s.numero_protocolo}</b> teve seu status alterado para <b>${s.status}</b>.</p>
           <p><b>Comentário:</b> ${s.comentario_aprovador || s.motivo_reprovacao || '-'}</p>`
  })
};

/**
 * Envia e-mail de notificação. Em ambiente sem SMTP configurado, apenas loga (não falha o fluxo principal).
 */
async function enviarEmailNotificacao(tipo, solicitacao) {
  if (!process.env.SMTP_HOST) {
    console.log(`[email] SMTP não configurado. Notificação "${tipo}" não enviada.`);
    return;
  }

  const template = TEMPLATES[tipo];
  if (!template) return;

  const { assunto, html } = template(solicitacao);
  const destinatarios = [solicitacao.solicitante_email, solicitacao.aprovador_email].filter(Boolean);
  if (destinatarios.length === 0) return;

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM,
    to: destinatarios.join(','),
    subject: assunto,
    html
  });
}

module.exports = { enviarEmailNotificacao };
