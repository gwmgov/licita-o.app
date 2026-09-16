const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/anexoController');
const { autenticar } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.use(autenticar);

router.post('/:solicitacaoId/upload', upload.array('arquivos', 10), ctrl.uploadAnexos);
router.get('/:solicitacaoId', ctrl.listarPorSolicitacao);
router.get('/download/:id', ctrl.download);
router.delete('/:id', ctrl.excluir);

module.exports = router;
