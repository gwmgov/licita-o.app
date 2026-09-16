const { body, validationResult } = require('express-validator');

const validarSolicitacao = [
  body('orgao').optional().isString().trim().isLength({ max: 150 }),
  body('edital_numero').optional().isString().trim().isLength({ max: 60 }),
  body('uf').optional().isString().isLength({ min: 2, max: 2 }),
  body('quantidade').optional().isInt({ min: 0 }).withMessage('Quantidade deve ser um número inteiro não negativo.'),
  body('valor_estimado').optional().isFloat({ min: 0 }).withMessage('Valor estimado deve ser um número não negativo.'),
  body('srp').optional().isBoolean(),
  body('apresentar_prototipo').optional().isBoolean(),
  body('seguro_garantia').optional().isBoolean(),
  body('transformacao').optional().isBoolean(),
  body('observacoes').optional().isString().trim().isLength({ max: 5000 }),

  (req, res, next) => {
    const erros = validationResult(req);
    if (!erros.isEmpty()) {
      return res.status(400).json({ erro: 'Dados inválidos.', detalhes: erros.array() });
    }
    next();
  }
];

module.exports = { validarSolicitacao };
