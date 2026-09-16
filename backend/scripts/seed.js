/**
 * Cria o usuário administrador inicial e alguns aprovadores de exemplo.
 * Uso via terminal: npm run seed
 * Também é reaproveitado pela rota /api/setup (deploy em nuvem, sem terminal).
 */
const bcrypt = require('bcrypt');

async function criarUsuariosIniciais(pool) {
  const senhaHash = await bcrypt.hash('Admin@123', 12);

  await pool.query(
    `INSERT INTO usuarios (nome, email, senha_hash, perfil, departamento)
     VALUES
       ('Administrador', 'admin@empresa.com', $1, 'ADMIN', 'TI'),
       ('Maria Aprovadora', 'maria.aprovadora@empresa.com', $1, 'APROVADOR', 'Diretoria Comercial'),
       ('João Solicitante', 'joao.solicitante@empresa.com', $1, 'SOLICITANTE', 'Comercial')
     ON CONFLICT (email) DO NOTHING`,
    [senhaHash]
  );
}

module.exports = { criarUsuariosIniciais };

// Permite continuar executando "npm run seed" no terminal, para quem instalou localmente.
if (require.main === module) {
  require('dotenv').config();
  const pool = require('../config/db');

  criarUsuariosIniciais(pool)
    .then(() => {
      console.log('Seed concluído. Usuários de exemplo (senha: Admin@123):');
      console.log(' - admin@empresa.com (ADMIN)');
      console.log(' - maria.aprovadora@empresa.com (APROVADOR)');
      console.log(' - joao.solicitante@empresa.com (SOLICITANTE)');
      return pool.end();
    })
    .catch((err) => {
      console.error('Erro ao executar seed:', err);
      process.exit(1);
    });
}
