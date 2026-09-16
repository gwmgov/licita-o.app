const pool = require('../config/db');

const Anexo = {
  async criar({ solicitacaoId, nomeArquivo, caminhoArquivo, tipoArquivo, tamanhoBytes, enviadoPor }) {
    const { rows } = await pool.query(
      `INSERT INTO anexos (solicitacao_id, nome_arquivo, caminho_arquivo, tipo_arquivo, tamanho_bytes, enviado_por)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [solicitacaoId, nomeArquivo, caminhoArquivo, tipoArquivo, tamanhoBytes, enviadoPor]
    );
    return rows[0];
  },

  async listarPorSolicitacao(solicitacaoId) {
    const { rows } = await pool.query(
      'SELECT * FROM anexos WHERE solicitacao_id = $1 ORDER BY data_upload',
      [solicitacaoId]
    );
    return rows;
  },

  async buscarPorId(id) {
    const { rows } = await pool.query('SELECT * FROM anexos WHERE id = $1', [id]);
    return rows[0];
  },

  async excluir(id) {
    await pool.query('DELETE FROM anexos WHERE id = $1', [id]);
  }
};

module.exports = Anexo;
