const pool = require('../config/db');

const HistoricoAprovacao = {
  async registrar({ solicitacaoId, acao, usuarioId, statusAnterior, statusNovo, observacao }) {
    const { rows } = await pool.query(
      `INSERT INTO historico_aprovacoes (solicitacao_id, acao, usuario_id, status_anterior, status_novo, observacao)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [solicitacaoId, acao, usuarioId, statusAnterior, statusNovo, observacao]
    );
    return rows[0];
  },

  async listarPorSolicitacao(solicitacaoId) {
    const { rows } = await pool.query(
      `SELECT h.*, u.nome AS usuario_nome
       FROM historico_aprovacoes h
       JOIN usuarios u ON u.id = h.usuario_id
       WHERE h.solicitacao_id = $1
       ORDER BY h.data_acao ASC`,
      [solicitacaoId]
    );
    return rows;
  }
};

module.exports = HistoricoAprovacao;
