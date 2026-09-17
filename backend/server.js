require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const { criarUsuariosIniciais } = require('./scripts/seed');

const authRoutes = require('./routes/authRoutes');
const solicitacaoRoutes = require('./routes/solicitacaoRoutes');
const anexoRoutes = require('./routes/anexoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');

const app = express();

// ==== Segurança básica ====
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Rate limiting geral (proteção contra abuso/brute-force)
const limiteGeral = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api/', limiteGeral);

// Rate limiting mais estrito para login
const limiteLogin = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { erro: 'Muitas tentativas. Tente novamente mais tarde.' } });
app.use('/api/auth/login', limiteLogin);

// ==== Rotas ====
app.use('/api/auth', authRoutes);
app.use('/api/solicitacoes', solicitacaoRoutes);
app.use('/api/anexos', anexoRoutes);
app.use('/api/usuarios', usuarioRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

/**
 * Rota de configuração inicial — pensada para deploy em nuvem sem acesso a
 * terminal ou console de banco. Cria as tabelas (a partir de sql/schema.sql)
 * e os usuários de exemplo. Protegida por SETUP_KEY: só funciona se a chave
 * informada na URL (?key=...) for igual à variável de ambiente SETUP_KEY.
 * Depois de usar uma vez com sucesso, é recomendável remover/trocar SETUP_KEY.
 */
app.get('/api/setup', async (req, res) => {
  if (!process.env.SETUP_KEY || req.query.key !== process.env.SETUP_KEY) {
    return res.status(403).json({ erro: 'Chave de configuração inválida ou não definida.' });
  }

  try {
    const caminhoSchema = path.join(__dirname, 'sql', 'schema.sql');
    const schemaSql = fs.readFileSync(caminhoSchema, 'utf8');
    await pool.query(schemaSql);
    await criarUsuariosIniciais(pool);

    res.json({
      mensagem: 'Banco de dados configurado com sucesso! Usuários de teste criados (senha: Admin@123).',
      usuarios: ['admin@empresa.com (ADMIN)', 'maria.aprovadora@empresa.com (APROVADOR)', 'joao.solicitante@empresa.com (SOLICITANTE)']
    });
  } catch (err) {
    if (err.message && err.message.includes('already exists')) {
      return res.status(200).json({ mensagem: 'O banco de dados já parece estar configurado (as tabelas já existem).' });
    }
    console.error(err);
    res.status(500).json({ erro: 'Erro ao configurar o banco de dados.', detalhe: err.message });
  }
});

/**
 * Rota de migração — atualiza um banco JÁ EXISTENTE (criado antes desta
 * versão) adicionando os novos campos, sem apagar nada do que já existe.
 * Protegida pela mesma SETUP_KEY.
 */
app.get('/api/migrate', async (req, res) => {
  if (!process.env.SETUP_KEY || req.query.key !== process.env.SETUP_KEY) {
    return res.status(403).json({ erro: 'Chave de configuração inválida ou não definida.' });
  }

  try {
    await pool.query(`
      ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE solicitacoes ADD COLUMN IF NOT EXISTS prazo_entrega_dias INTEGER;
    `);
    res.json({ mensagem: 'Banco de dados atualizado com sucesso com os novos campos (itens e prazo em dias).' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao atualizar o banco de dados.', detalhe: err.message });
  }
});

// ==== Tratamento de erros global ====
app.use((err, req, res, next) => {
  console.error(err);
  if (err.name === 'MulterError' || err.message?.includes('Tipo de arquivo')) {
    return res.status(400).json({ erro: err.message });
  }
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
