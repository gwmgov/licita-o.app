const pool = require('../config/db');

// Campos que ficam direto na tabela solicitacoes (nível da licitação, não do item)
const CAMPOS_LICITACAO = [
  'data_licitacao', 'hora_licitacao', 'concessionaria', 'edital_numero', 'orgao', 'uf',
  'prazo_entrega_dias', 'area_departamento', 'srp', 'valor_estimado',
  'seguro_garantia', 'transformacao', 'observacoes'
];

const Solicitacao = {
  async gerarProtocolo() {
    const { rows } = await pool.query('SELECT gerar_numero_protocolo() AS protocolo');
    return rows[0].protocolo;
  },

  async criar(dados, usuarioId) {
    const protocolo = await this.gerarProtocolo();
    const colunas = ['numero_protocolo', 'solicitante_id', 'criado_por', 'itens', ...CAMPOS_LICITACAO];
    const valores = [
      protocolo,
      usuarioId,
      usuarioId,
      JSON.stringify(dados.itens || []),
      ...CAMPOS_LICITACAO.map((c) => dados[c] ?? null)
    ];
    const placeholders = valores.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await pool.query(
      `INSERT INTO solicitacoes (${colunas.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      valores
    );
    return rows[0];
  },

  async buscarPorId(id) {
    const { rows } = await pool.query(
      `SELECT s.*,
              u1.nome AS solicitante_nome, u1.email AS solicitante_email,
              u2.nome AS aprovador_nome, u2.email AS aprovador_email
       FROM solicitacoes s
       JOIN usuarios u1 ON u1.id = s.solicitante_id
       LEFT JOIN usuarios u2 ON u2.id = s.aprovador_id
       WHERE s.id = $1`,
      [id]
    );
    return rows[0];
  },

  async atualizar(id, dados) {
    const colunasValidas = CAMPOS_LICITACAO.filter((c) => dados[c] !== undefined);
    const setClauses = colunasValidas.map((c, i) => `${c} = $${i + 1}`);
    const valores = colunasValidas.map((c) => dados[c]);

    if (dados.itens !== undefined) {
      setClauses.push(`itens = $${valores.length + 1}`);
      valores.push(JSON.stringify(dados.itens));
    }

    if (setClauses.length === 0) return this.buscarPorId(id);

    valores.push(id);
    const { rows } = await pool.query(
      `UPDATE solicitacoes SET ${setClauses.join(', ')} WHERE id = $${valores.length} RETURNING *`,
      valores
    );
    return rows[0];
  },

  async atualizarStatus(id, { status, aprovadorId, comentarioAprovador, motivoReprovacao }) {
    const { rows } = await pool.query(
      `UPDATE solicitacoes
       SET status = $1,
           aprovador_id = COALESCE($2, aprovador_id),
           data_aprovacao = CASE WHEN $1 IN ('APROVADO','REPROVADO') THEN now() ELSE data_aprovacao END,
           comentario_aprovador = COALESCE($3, comentario_aprovador),
           motivo_reprovacao = COALESCE($4, motivo_reprovacao)
       WHERE id = $5
       RETURNING *`,
      [status, aprovadorId, comentarioAprovador, motivoReprovacao, id]
    );
    return rows[0];
  },

  /**
   * Pesquisa paginada com filtros dinâmicos (todos os parâmetros são parametrizados).
   */
  async pesquisar(filtros, pagina = 1, tamanhoPagina = 20) {
    const condicoes = [];
    const valores = [];
    let idx = 1;

    const mapa = {
      status: 's.status = $',
      edital: 's.edital_numero ILIKE $',
      orgao: 's.orgao ILIKE $',
      concessionaria: 's.concessionaria ILIKE $',
      uf: 's.uf = $',
      solicitante: 'u1.nome ILIKE $',
      aprovador: 'u2.nome ILIKE $',
      dataLicitacaoInicio: 's.data_licitacao >= $',
      dataLicitacaoFim: 's.data_licitacao <= $',
      dataSolicitacaoInicio: 's.data_solicitacao >= $',
      dataSolicitacaoFim: 's.data_solicitacao <= $'
    };

    for (const [chave, clausula] of Object.entries(mapa)) {
      if (filtros[chave] !== undefined && filtros[chave] !== '') {
        condicoes.push(clausula + idx);
        const usaLike = clausula.includes('ILIKE');
        valores.push(usaLike ? `%${filtros[chave]}%` : filtros[chave]);
        idx++;
      }
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const offset = (pagina - 1) * tamanhoPagina;

    const queryDados = `
      SELECT s.*, u1.nome AS solicitante_nome, u2.nome AS aprovador_nome
      FROM solicitacoes s
      JOIN usuarios u1 ON u1.id = s.solicitante_id
      LEFT JOIN usuarios u2 ON u2.id = s.aprovador_id
      ${where}
      ORDER BY s.criado_em DESC
      LIMIT $${idx} OFFSET $${idx + 1}`;

    const queryTotal = `
      SELECT COUNT(*) AS total
      FROM solicitacoes s
      JOIN usuarios u1 ON u1.id = s.solicitante_id
      LEFT JOIN usuarios u2 ON u2.id = s.aprovador_id
      ${where}`;

    const [dados, total] = await Promise.all([
      pool.query(queryDados, [...valores, tamanhoPagina, offset]),
      pool.query(queryTotal, valores)
    ]);

    return {
      dados: dados.rows,
      total: parseInt(total.rows[0].total, 10),
      pagina,
      tamanhoPagina
    };
  },

  async indicadoresDashboard() {
    const { rows } = await pool.query('SELECT * FROM vw_dashboard_indicadores');
    return rows[0];
  }
};

module.exports = Solicitacao;
