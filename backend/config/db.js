/**
 * Pool de conexões PostgreSQL.
 * Usa parametrização em 100% das queries do sistema (proteção contra SQL Injection).
 */
const { Pool } = require('pg');
require('dotenv').config();

/**
 * Serviços de nuvem (Railway, Render, Supabase) costumam fornecer uma única
 * variável DATABASE_URL em vez de host/porta/usuário separados. Se ela existir,
 * usamos-a diretamente; caso contrário, caímos nas variáveis individuais
 * (usadas em instalação local/on-premise).
 */
const configuracao = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false }
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool({
  ...configuracao,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL:', err);
});

module.exports = pool;
