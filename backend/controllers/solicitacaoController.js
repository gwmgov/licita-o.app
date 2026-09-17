const Solicitacao = require('../models/Solicitacao');
const Anexo = require('../models/Anexo');
const HistoricoAprovacao = require('../models/HistoricoAprovacao');
const { enviarEmailNotificacao } = require('../services/emailService');
const { notificarPowerAutomate } = require('../services/integracaoService');

async function criar(req, res) {
  try {
    const solicitacao = await Solicitacao.criar(req.body, req.usuario.id);

    await HistoricoAprovacao.registrar({
      solicitacaoId: solicitacao.id,
      acao: 'CRIACAO',
      usuarioId: req.usuario.id,
      statusAnterior: null,
      statusNovo: 'RASCUNHO',
      observacao: 'Solicitação criada.'
    });

    res.status(201).json(solicitacao);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao criar solicitação.', detalhe: err.message });
  }
}

async function atualizar(req, res) {
  try {
    const { id } = req.params;
    const atual = await Solicitacao.buscarPorId(id);
    if (!atual) return res.status(404).json({ erro: 'Solicitação não encontrada.' });

    if (!['RASCUNHO', 'PENDENTE_APROVACAO'].includes(atual.status)) {
      return res.status(400).json({ erro: 'Somente solicitações em Rascunho ou Pendentes podem ser editadas.' });
    }

    const atualizada = await Solicitacao.atualizar(id, req.body);

    await HistoricoAprovacao.registrar({
      solicitacaoId: id,
      acao: 'EDICAO',
      usuarioId: req.usuario.id,
      statusAnterior: atual.status,
      statusNovo: atualizada.status,
      observacao: 'Dados da solicitação atualizados.'
    });

    res.json(atualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar solicitação.', detalhe: err.message });
  }
}

async function enviarParaAprovacao(req, res) {
  try {
    const { id } = req.params;
    const atual = await Solicitacao.buscarPorId(id);
    if (!atual) return res.status(404).json({ erro: 'Solicitação não encontrada.' });

    const atualizada = await Solicitacao.atualizarStatus(id, { status: 'PENDENTE_APROVACAO' });

    await HistoricoAprovacao.registrar({
      solicitacaoId: id,
      acao: 'ENVIO_APROVACAO',
      usuarioId: req.usuario.id,
      statusAnterior: atual.status,
      statusNovo: 'PENDENTE_APROVACAO',
      observacao: 'Solicitação enviada para aprovação.'
    });

    enviarEmailNotificacao('nova_solicitacao', atualizada).catch(console.error);
    notificarPowerAutomate('nova_solicitacao', atualizada).catch(console.error);

    res.json(atualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao enviar solicitação para aprovação.', detalhe: err.message });
  }
}

async function buscarPorId(req, res) {
  try {
    const solicitacao = await Solicitacao.buscarPorId(req.params.id);
    if (!solicitacao) return res.status(404).json({ erro: 'Solicitação não encontrada.' });

    const [anexos, historico] = await Promise.all([
      Anexo.listarPorSolicitacao(req.params.id),
      HistoricoAprovacao.listarPorSolicitacao(req.params.id)
    ]);

    res.json({ ...solicitacao, anexos, historico });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao buscar solicitação.', detalhe: err.message });
  }
}

async function pesquisar(req, res) {
  try {
    const { pagina = 1, tamanhoPagina = 20, ...filtros } = req.query;
    const resultado = await Solicitacao.pesquisar(filtros, parseInt(pagina, 10), parseInt(tamanhoPagina, 10));
    res.json(resultado);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao pesquisar solicitações.', detalhe: err.message });
  }
}

async function dashboard(req, res) {
  try {
    const indicadores = await Solicitacao.indicadoresDashboard();
    res.json(indicadores);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao carregar indicadores do dashboard.', detalhe: err.message });
  }
}

// ==== Ações de aprovação (perfil APROVADOR / ADMIN) ====

async function iniciarAnalise(req, res) {
  await transicionarStatus(req, res, 'EM_ANALISE', 'INICIO_ANALISE', 'Solicitação em análise pelo aprovador.');
}

async function aprovar(req, res) {
  const { comentario } = req.body;
  await transicionarStatus(req, res, 'APROVADO', 'APROVACAO', comentario || 'Solicitação aprovada.', {
    comentarioAprovador: comentario
  });
}

async function reprovar(req, res) {
  const { motivo } = req.body;
  if (!motivo) return res.status(400).json({ erro: 'Motivo da reprovação é obrigatório.' });
  await transicionarStatus(req, res, 'REPROVADO', 'REPROVACAO', motivo, { motivoReprovacao: motivo });
}

async function solicitarAjustes(req, res) {
  const { comentario } = req.body;
  await transicionarStatus(req, res, 'RASCUNHO', 'SOLICITACAO_AJUSTE', comentario || 'Ajustes solicitados ao solicitante.', {
    comentarioAprovador: comentario
  });
}

async function cancelar(req, res) {
  await transicionarStatus(req, res, 'CANCELADO', 'CANCELAMENTO', 'Solicitação cancelada.');
}

async function transicionarStatus(req, res, novoStatus, acao, observacao, extras = {}) {
  try {
    const { id } = req.params;
    const atual = await Solicitacao.buscarPorId(id);
    if (!atual) return res.status(404).json({ erro: 'Solicitação não encontrada.' });

    const atualizada = await Solicitacao.atualizarStatus(id, {
      status: novoStatus,
      aprovadorId: req.usuario.id,
      ...extras
    });

    await HistoricoAprovacao.registrar({
      solicitacaoId: id,
      acao,
      usuarioId: req.usuario.id,
      statusAnterior: atual.status,
      statusNovo: novoStatus,
      observacao
    });

    enviarEmailNotificacao('mudanca_status', atualizada).catch(console.error);
    notificarPowerAutomate('mudanca_status', atualizada).catch(console.error);

    res.json(atualizada);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar status da solicitação.', detalhe: err.message });
  }
}

module.exports = {
  criar,
  atualizar,
  enviarParaAprovacao,
  buscarPorId,
  pesquisar,
  dashboard,
  iniciarAnalise,
  aprovar,
  reprovar,
  solicitarAjustes,
  cancelar
};
