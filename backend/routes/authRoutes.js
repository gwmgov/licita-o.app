const express = require('express');
const router = express.Router();
const { login, registrar, me } = require('../controllers/authController');
const { autenticar, autorizar } = require('../middleware/auth');

router.post('/login', login);
// Somente ADMIN pode cadastrar novos usuários
router.post('/registrar', autenticar, autorizar('ADMIN'), registrar);
router.get('/me', autenticar, me);

module.exports = router;
