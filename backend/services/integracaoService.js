/**
 * Camada de integração com o ecossistema Microsoft 365.
 * Hoje envia um webhook HTTP simples para o Power Automate quando configurado;
 * serve de ponto único de extensão para Teams, Outlook e SharePoint (ver README, seção "Evolução Futura").
 */
async function notificarPowerAutomate(evento, solicitacao) {
  const url = process.env.POWER_AUTOMATE_WEBHOOK_URL;
  if (!url) {
    console.log(`[integracao] POWER_AUTOMATE_WEBHOOK_URL não configurado. Evento "${evento}" não enviado.`);
    return;
  }

  const payload = {
    evento,
    protocolo: solicitacao.numero_protocolo,
    status: solicitacao.status,
    orgao: solicitacao.orgao,
    edital: solicitacao.edital_numero,
    valorEstimado: solicitacao.valor_estimado,
    dataEvento: new Date().toISOString()
  };

  const resposta = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!resposta.ok) {
    console.error(`[integracao] Falha ao notificar Power Automate: ${resposta.status}`);
  }
}

module.exports = { notificarPowerAutomate };
