exigirAutenticacao();
exibirUsuarioLogado();

const params = new URLSearchParams(window.location.search);
const solicitacaoId = params.get('id');

const CAMPOS_EXIBICAO = [
  ['data_licitacao', 'Data da Licitação', formatarData],
  ['hora_licitacao', 'Hora da Licitação', (v) => v || '-'],
  ['orgao', 'Órgão', (v) => v || '-'],
  ['edital_numero', 'Edital Nº', (v) => v || '-'],
  ['uf', 'UF', (v) => v || '-'],
  ['concessionaria', 'Concessionária', (v) => v || '-'],
  ['prazo_entrega_dias', 'Prazo de Entrega', (v) => (v ? `${v} dias` : '-')],
  ['srp', 'SRP', (v) => (v ? 'Sim' : 'Não')],
  ['valor_estimado', 'Valor Estimado', formatarMoeda],
  ['seguro_garantia', 'Seguro Garantia?', (v) => (v ? 'Sim' : 'Não')],
  ['transformacao', 'Transformação?', (v) => (v ? 'Sim' : 'Não')],
  ['observacoes', 'Observações', (v) => v || '-']
];

const ROTULOS_ACAO = {
  CRIACAO: 'Solicitação criada',
  EDICAO: 'Dados atualizados',
  ENVIO_APROVACAO: 'Enviada para aprovação',
  INICIO_ANALISE: 'Análise iniciada',
  APROVACAO: 'Aprovada',
  REPROVACAO: 'Reprovada',
  SOLICITACAO_AJUSTE: 'Ajustes solicitados',
  CANCELAMENTO: 'Cancelada',
  REENVIO: 'Reenviada'
};

if (solicitacaoId) {
  document.getElementById('visao-fila').style.display = 'none';
  document.getElementById('visao-detalhe').style.display = 'block';
  if (params.get('criada')) document.getElementById('alerta-criada').style.display = 'block';
  carregarDetalhe();
} else {
  carregarFila();
}

async function carregarFila() {
  try {
    const resultado = await API.get('/solicitacoes?tamanhoPagina=50');
    const pendentes = resultado.dados.filter((s) => ['PENDENTE_APROVACAO', 'EM_ANALISE'].includes(s.status));
    const corpo = document.getElementById('tabela-fila');
    corpo.innerHTML = pendentes.length
      ? pendentes.map((s) => `
        <tr onclick="window.location.href='aprovacao.html?id=${s.id}'">
          <td><span class="protocolo-tag">${s.numero_protocolo}</span></td>
          <td>${s.orgao || '-'}</td>
          <td>${s.edital_numero || '-'}</td>
          <td>${s.solicitante_nome}</td>
          <td>${formatarMoeda(s.valor_estimado)}</td>
          <td>${seloStatusHtml(s.status)}</td>
        </tr>`).join('')
      : '<tr><td colspan="6" class="text-center text-muted py-4">Nenhuma solicitação pendente de decisão.</td></tr>';
  } catch (err) {
    document.getElementById('tabela-fila').innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${err.message}</td></tr>`;
  }
}

async function carregarDetalhe() {
  try {
    const s = await API.get(`/solicitacoes/${solicitacaoId}`);

    document.getElementById('detalhe-titulo').textContent = `Solicitação — ${s.orgao || 'Sem órgão informado'}`;
    document.getElementById('detalhe-protocolo').textContent = s.numero_protocolo;
    document.getElementById('detalhe-selo').innerHTML = seloStatusHtml(s.status);

    document.getElementById('grid-dados-licitacao').innerHTML = CAMPOS_EXIBICAO.map(([campo, rotulo, fmt]) => `
      <div class="col-md-6">
        <div class="text-muted" style="font-size:0.75rem;">${rotulo}</div>
        <div>${fmt(s[campo])}</div>
      </div>`).join('') + `
      <div class="col-md-6"><div class="text-muted" style="font-size:0.75rem;">Solicitante</div><div>${s.solicitante_nome} (${s.solicitante_email})</div></div>
      <div class="col-md-6"><div class="text-muted" style="font-size:0.75rem;">Aprovador</div><div>${s.aprovador_nome || '-'}</div></div>
      ${s.motivo_reprovacao ? `<div class="col-12"><div class="text-muted" style="font-size:0.75rem;">Motivo da Reprovação</div><div class="text-danger">${s.motivo_reprovacao}</div></div>` : ''}
      ${s.comentario_aprovador ? `<div class="col-12"><div class="text-muted" style="font-size:0.75rem;">Comentário do Aprovador</div><div>${s.comentario_aprovador}</div></div>` : ''}
    `;

    const itens = s.itens || [];
    document.getElementById('tabela-itens-detalhe').innerHTML = itens.length
      ? itens.map((it) => `
        <tr>
          <td>${it.item || '-'}</td>
          <td>${it.modelo || '-'}</td>
          <td>${it.versao || '-'}</td>
          <td>${it.m_y || '-'}</td>
          <td>${it.cor || '-'}</td>
          <td>${it.quantidade ?? '-'}</td>
          <td>${it.apresentar_prototipo ? 'Sim' : 'Não'}</td>
        </tr>`).join('')
      : '<tr><td colspan="7" class="text-muted text-center">Nenhum item cadastrado.</td></tr>';

    document.getElementById('lista-anexos-detalhe').innerHTML = s.anexos.length
      ? s.anexos.map((a) => `<li class="mb-1">📎 <a href="${API.baseUrl}/anexos/download/${a.id}" target="_blank">${a.nome_arquivo}</a> <span class="text-muted small">(${(a.tamanho_bytes / 1024).toFixed(0)} KB)</span></li>`).join('')
      : '<li class="text-muted">Nenhum anexo enviado.</li>';

    document.getElementById('linha-tempo-historico').innerHTML = s.historico.map((h) => `
      <li>
        <div class="data">${formatarDataHora(h.data_acao)}</div>
        <div><strong>${ROTULOS_ACAO[h.acao] || h.acao}</strong> por ${h.usuario_nome}</div>
        ${h.observacao ? `<div class="text-muted small">${h.observacao}</div>` : ''}
      </li>`).join('');

    configurarBotoesAcao(s);
  } catch (err) {
    document.getElementById('visao-detalhe').innerHTML = `<div class="alert alert-danger">${err.message}</div>`;
  }
}

function configurarBotoesAcao(s) {
  const usuario = API.usuario();
  const podeAprovar = ['APROVADOR', 'ADMIN'].includes(usuario.perfil);
  const painel = document.getElementById('painel-acoes');

  if (!['PENDENTE_APROVACAO', 'EM_ANALISE'].includes(s.status) || !podeAprovar) {
    painel.style.display = 'none';
    return;
  }

  document.getElementById('btn-iniciar-analise').style.display = s.status === 'PENDENTE_APROVACAO' ? 'block' : 'none';

  const executarAcao = async (endpoint, corpo = {}) => {
    const erroEl = document.getElementById('erro-acao');
    erroEl.style.display = 'none';
    try {
      await API.post(`/solicitacoes/${solicitacaoId}/${endpoint}`, corpo);
      window.location.reload();
    } catch (err) {
      erroEl.textContent = err.message;
      erroEl.style.display = 'block';
    }
  };

  document.getElementById('btn-iniciar-analise').onclick = () => executarAcao('iniciar-analise');
  document.getElementById('btn-aprovar').onclick = () => executarAcao('aprovar', { comentario: document.getElementById('comentario-acao').value });
  document.getElementById('btn-reprovar').onclick = () => {
    const motivo = document.getElementById('comentario-acao').value;
    if (!motivo) { document.getElementById('erro-acao').textContent = 'Informe o motivo da reprovação no campo de comentário.'; document.getElementById('erro-acao').style.display = 'block'; return; }
    executarAcao('reprovar', { motivo });
  };
  document.getElementById('btn-ajustes').onclick = () => executarAcao('solicitar-ajustes', { comentario: document.getElementById('comentario-acao').value });
  document.getElementById('btn-cancelar').onclick = () => executarAcao('cancelar');
}
