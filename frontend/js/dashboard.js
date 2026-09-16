exigirAutenticacao();
exibirUsuarioLogado();

async function carregarDashboard() {
  try {
    const indicadores = await API.get('/solicitacoes/dashboard');
    document.getElementById('ind-total').textContent = indicadores.total_solicitacoes;
    document.getElementById('ind-pendentes').textContent = indicadores.total_pendentes;
    document.getElementById('ind-analise').textContent = indicadores.total_em_analise;
    document.getElementById('ind-aprovadas').textContent = indicadores.total_aprovadas;
    document.getElementById('ind-reprovadas').textContent = indicadores.total_reprovadas;
    document.getElementById('ind-valor-em-aprovacao').textContent = formatarMoeda(indicadores.valor_total_em_aprovacao);
    document.getElementById('ind-valor-aprovado').textContent = formatarMoeda(indicadores.valor_total_aprovado);

    const resultado = await API.get('/solicitacoes?pagina=1&tamanhoPagina=8');
    const corpo = document.getElementById('tabela-recentes');
    corpo.innerHTML = resultado.dados.length
      ? resultado.dados.map((s) => `
        <tr onclick="window.location.href='aprovacao.html?id=${s.id}'">
          <td><span class="protocolo-tag">${s.numero_protocolo}</span></td>
          <td>${s.orgao || '-'}</td>
          <td>${s.edital_numero || '-'}</td>
          <td>${s.solicitante_nome}</td>
          <td>${formatarMoeda(s.valor_estimado)}</td>
          <td>${seloStatusHtml(s.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="text-muted text-center py-4">Nenhuma solicitação cadastrada ainda.</td></tr>';
  } catch (err) {
    console.error(err);
  }
}

carregarDashboard();
