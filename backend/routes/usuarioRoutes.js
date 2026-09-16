const express = require('express');
const router = express.Router();
const Usuario = require('../models/Usuario');
const { autenticar, autorizar } = require('../middleware/auth');

router.use(autenticar);

// Lista de aprovadores (usada em selects do front-end)
router.get('/aprovadores', async (req, res) => {
  const aprovadores = await Usuario.listarAprovadores();
  res.json(aprovadores);
});

// Gestão de usuários - somente ADMIN
router.get('/', autorizar('ADMIN'), async (req, res) => {
  const usuarios = await Usuario.listar();
  res.json(usuarios);
});

router.patch('/:id/status', autorizar('ADMIN'), async (req, res) => {
  await Usuario.atualizarStatus(req.params.id, req.body.ativo);
  res.status(204).send();
});

module.exports = router;
