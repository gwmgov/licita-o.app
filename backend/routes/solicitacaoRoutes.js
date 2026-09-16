const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/solicitacaoController');
const { autenticar, autorizar } = require('../middleware/auth');
const { validarSolicitacao } = require('../middleware/validation');

router.use(autenticar);

// Dashboard e pesquisa
router.get('/dashboard', ctrl.dashboard);
router.get('/', ctrl.pesquisar);
router.get('/:id', ctrl.buscarPorId);

// CRUD (SOLICITANTE cria/edita suas próprias solicitações; ADMIN tudo)
router.post('/', validarSolicitacao, ctrl.criar);
router.put('/:id', validarSolicitacao, ctrl.atualizar);
router.post('/:id/enviar', ctrl.enviarParaAprovacao);

// Ações de aprovação (somente APROVADOR / ADMIN)
router.post('/:id/iniciar-analise', autorizar('APROVADOR', 'ADMIN'), ctrl.iniciarAnalise);
router.post('/:id/aprovar', autorizar('APROVADOR', 'ADMIN'), ctrl.aprovar);
router.post('/:id/reprovar', autorizar('APROVADOR', 'ADMIN'), ctrl.reprovar);
router.post('/:id/solicitar-ajustes', autorizar('APROVADOR', 'ADMIN'), ctrl.solicitarAjustes);
router.post('/:id/cancelar', ctrl.cancelar);

module.exports = router;
