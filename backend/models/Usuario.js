const pool = require('../config/db');

const Usuario = {
  async buscarPorEmail(email) {
    const { rows } = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE',
      [email]
    );
    return rows[0];
  },

  async buscarPorId(id) {
    const { rows } = await pool.query(
      'SELECT id, nome, email, perfil, departamento, ativo, criado_em FROM usuarios WHERE id = $1',
      [id]
    );
    return rows[0];
  },

  async listar() {
    const { rows } = await pool.query(
      'SELECT id, nome, email, perfil, departamento, ativo, criado_em FROM usuarios ORDER BY nome'
    );
    return rows;
  },

  async listarAprovadores() {
    const { rows } = await pool.query(
      `SELECT id, nome, email FROM usuarios WHERE perfil IN ('APROVADOR','ADMIN') AND ativo = TRUE ORDER BY nome`
    );
    return rows;
  },

  async criar({ nome, email, senhaHash, perfil, departamento }) {
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nome, email, senha_hash, perfil, departamento)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nome, email, perfil, departamento, criado_em`,
      [nome, email, senhaHash, perfil, departamento]
    );
    return rows[0];
  },

  async atualizarStatus(id, ativo) {
    await pool.query('UPDATE usuarios SET ativo = $1 WHERE id = $2', [ativo, id]);
  }
};

module.exports = Usuario;
