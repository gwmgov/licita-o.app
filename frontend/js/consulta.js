exigirAutenticacao();
exibirUsuarioLogado();

let paginaAtual = 1;
const TAMANHO_PAGINA = 15;
let totalRegistros = 0;

async function pesquisar() {
  const formData = new FormData(document.getElementById('form-filtros'));
  const params = new URLSearchParams({ pagina: paginaAtual, tamanhoPagina: TAMANHO_PAGINA });
  for (const [chave, valor] of formData.entries()) {
    if (valor) params.append(chave, valor);
  }

  const corpo = document.getElementById('tabela-resultados');
  corpo.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">Buscando…</td></tr>';

  try {
    const resultado = await API.get(`/solicitacoes?${params.toString()}`);
    totalRegistros = resultado.total;

    corpo.innerHTML = resultado.dados.length
      ? resultado.dados.map((s) => `
        <tr onclick="window.location.href='aprovacao.html?id=${s.id}'">
          <td><span class="protocolo-tag">${s.numero_protocolo}</span></td>
          <td>${s.orgao || '-'}</td>
          <td>${s.edital_numero || '-'}</td>
          <td>${s.uf || '-'}</td>
          <td>${s.solicitante_nome}</td>
          <td>${formatarMoeda(s.valor_estimado)}</td>
          <td>${seloStatusHtml(s.status)}</td>
          <td>${formatarData(s.data_solicitacao)}</td>
        </tr>`).join('')
      : '<tr><td colspan="8" class="text-center text-muted py-4">Nenhum resultado encontrado para os filtros informados.</td></tr>';

    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / TAMANHO_PAGINA));
    document.getElementById('info-paginacao').textContent = `Página ${paginaAtual} de ${totalPaginas} — ${totalRegistros} registro(s)`;
  } catch (err) {
    corpo.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${err.message}</td></tr>`;
  }
}

document.getElementById('form-filtros').addEventListener('submit', (e) => {
  e.preventDefault();
  paginaAtual = 1;
  pesquisar();
});

document.getElementById('btn-pag-anterior').addEventListener('click', () => {
  if (paginaAtual > 1) { paginaAtual--; pesquisar(); }
});
document.getElementById('btn-pag-proxima').addEventListener('click', () => {
  if (paginaAtual * TAMANHO_PAGINA < totalRegistros) { paginaAtual++; pesquisar(); }
});

pesquisar();
