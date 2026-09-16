const jwt = require('jsonwebtoken');

/**
 * Verifica o token JWT enviado no header Authorization: Bearer <token>
 */
function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação não informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, nome, email, perfil }
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado.' });
  }
}

/**
 * Restringe o acesso a determinados perfis.
 * Uso: autorizar('ADMIN', 'APROVADOR')
 */
function autorizar(...perfisPermitidos) {
  return (req, res, next) => {
    if (!req.usuario || !perfisPermitidos.includes(req.usuario.perfil)) {
      return res.status(403).json({ erro: 'Você não tem permissão para executar esta ação.' });
    }
    next();
  };
}

module.exports = { autenticar, autorizar };
