-- =====================================================================
-- SISTEMA DE SOLICITAÇÃO E APROVAÇÃO DE PARTICIPAÇÃO EM LICITAÇÕES
-- Script de criação do banco de dados - PostgreSQL 14+
-- =====================================================================

-- Extensão para geração de UUID
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- ENUM TYPES
-- =====================================================================
CREATE TYPE perfil_usuario AS ENUM ('SOLICITANTE', 'APROVADOR', 'ADMIN');

CREATE TYPE status_solicitacao AS ENUM (
    'RASCUNHO',
    'PENDENTE_APROVACAO',
    'EM_ANALISE',
    'APROVADO',
    'REPROVADO',
    'CANCELADO'
);

CREATE TYPE acao_historico AS ENUM (
    'CRIACAO',
    'EDICAO',
    'ENVIO_APROVACAO',
    'INICIO_ANALISE',
    'APROVACAO',
    'REPROVACAO',
    'SOLICITACAO_AJUSTE',
    'CANCELAMENTO',
    'REENVIO'
);

-- =====================================================================
-- TABELA: usuarios
-- =====================================================================
CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            VARCHAR(150)        NOT NULL,
    email           VARCHAR(150)        NOT NULL UNIQUE,
    senha_hash      VARCHAR(255)        NOT NULL,
    perfil          perfil_usuario      NOT NULL DEFAULT 'SOLICITANTE',
    departamento    VARCHAR(100),
    ativo           BOOLEAN             NOT NULL DEFAULT TRUE,
    criado_em       TIMESTAMPTZ         NOT NULL DEFAULT now(),
    atualizado_em   TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_email ON usuarios(email);
CREATE INDEX idx_usuarios_perfil ON usuarios(perfil);

-- =====================================================================
-- TABELA: solicitacoes
-- =====================================================================
CREATE TABLE solicitacoes (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_protocolo            VARCHAR(30)  NOT NULL UNIQUE, -- ex: SOL-2026-000123

    -- Dados do solicitante
    solicitante_id              UUID NOT NULL REFERENCES usuarios(id),
    area_departamento           VARCHAR(100),
    data_solicitacao            TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Dados da licitação
    data_licitacao              DATE,
    hora_licitacao               TIME,
    concessionaria               VARCHAR(150),
    edital_numero                VARCHAR(60),
    orgao                         VARCHAR(150),
    uf                            CHAR(2),
    prazo_entrega                 DATE,
    item                          VARCHAR(150),
    modelo                        VARCHAR(150),
    versao                        VARCHAR(50),
    m_y                           VARCHAR(20),   -- Model Year (ex: 2026)
    cor                           VARCHAR(50),
    quantidade                    INTEGER CHECK (quantidade >= 0),
    srp                           BOOLEAN DEFAULT FALSE,
    valor_estimado                NUMERIC(15,2) CHECK (valor_estimado >= 0),
    apresentar_prototipo          BOOLEAN DEFAULT FALSE,
    acessorios                    TEXT,
    revisoes                      TEXT,
    seguro_garantia               BOOLEAN DEFAULT FALSE,
    transformacao                 BOOLEAN DEFAULT FALSE,
    observacoes                   TEXT,

    -- Fluxo / status
    status                        status_solicitacao NOT NULL DEFAULT 'RASCUNHO',

    -- Dados de aprovação
    aprovador_id                  UUID REFERENCES usuarios(id),
    data_aprovacao                 TIMESTAMPTZ,
    comentario_aprovador           TEXT,
    motivo_reprovacao              TEXT,

    -- Rastreabilidade
    criado_por                     UUID NOT NULL REFERENCES usuarios(id),
    criado_em                      TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_solicitacoes_status ON solicitacoes(status);
CREATE INDEX idx_solicitacoes_edital ON solicitacoes(edital_numero);
CREATE INDEX idx_solicitacoes_orgao ON solicitacoes(orgao);
CREATE INDEX idx_solicitacoes_concessionaria ON solicitacoes(concessionaria);
CREATE INDEX idx_solicitacoes_uf ON solicitacoes(uf);
CREATE INDEX idx_solicitacoes_solicitante ON solicitacoes(solicitante_id);
CREATE INDEX idx_solicitacoes_aprovador ON solicitacoes(aprovador_id);
CREATE INDEX idx_solicitacoes_data_licitacao ON solicitacoes(data_licitacao);
CREATE INDEX idx_solicitacoes_data_solicitacao ON solicitacoes(data_solicitacao);

-- Trigger para manter atualizado_em sempre corrente
CREATE OR REPLACE FUNCTION trg_set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_atualizado_em_solicitacoes
    BEFORE UPDATE ON solicitacoes
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER set_atualizado_em_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION trg_set_atualizado_em();

-- Sequência e função para gerar número de protocolo (SOL-AAAA-NNNNNN)
CREATE SEQUENCE seq_protocolo_solicitacao START 1;

CREATE OR REPLACE FUNCTION gerar_numero_protocolo()
RETURNS TEXT AS $$
DECLARE
    proximo BIGINT;
BEGIN
    proximo := nextval('seq_protocolo_solicitacao');
    RETURN 'SOL-' || to_char(now(), 'YYYY') || '-' || lpad(proximo::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- =====================================================================
-- TABELA: anexos
-- =====================================================================
CREATE TABLE anexos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id  UUID NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
    nome_arquivo    VARCHAR(255) NOT NULL,
    caminho_arquivo VARCHAR(500) NOT NULL,
    tipo_arquivo    VARCHAR(100),
    tamanho_bytes   BIGINT,
    enviado_por     UUID NOT NULL REFERENCES usuarios(id),
    data_upload     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_anexos_solicitacao ON anexos(solicitacao_id);

-- =====================================================================
-- TABELA: historico_aprovacoes
-- =====================================================================
CREATE TABLE historico_aprovacoes (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    solicitacao_id      UUID NOT NULL REFERENCES solicitacoes(id) ON DELETE CASCADE,
    acao                acao_historico NOT NULL,
    usuario_id          UUID NOT NULL REFERENCES usuarios(id),
    status_anterior     status_solicitacao,
    status_novo         status_solicitacao,
    observacao          TEXT,
    data_acao           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_historico_solicitacao ON historico_aprovacoes(solicitacao_id);
CREATE INDEX idx_historico_data ON historico_aprovacoes(data_acao);

-- =====================================================================
-- TABELA: auditoria (log de segurança / acessos)
-- =====================================================================
CREATE TABLE auditoria (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id      UUID REFERENCES usuarios(id),
    acao            VARCHAR(100) NOT NULL,
    entidade        VARCHAR(100),
    entidade_id     UUID,
    ip_origem       VARCHAR(50),
    detalhes        JSONB,
    data_evento     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX idx_auditoria_data ON auditoria(data_evento);

-- =====================================================================
-- VIEW: dashboard de indicadores
-- =====================================================================
CREATE OR REPLACE VIEW vw_dashboard_indicadores AS
SELECT
    COUNT(*)                                                              AS total_solicitacoes,
    COUNT(*) FILTER (WHERE status = 'PENDENTE_APROVACAO')                 AS total_pendentes,
    COUNT(*) FILTER (WHERE status = 'EM_ANALISE')                        AS total_em_analise,
    COUNT(*) FILTER (WHERE status = 'APROVADO')                          AS total_aprovadas,
    COUNT(*) FILTER (WHERE status = 'REPROVADO')                         AS total_reprovadas,
    COALESCE(SUM(valor_estimado) FILTER (WHERE status IN ('PENDENTE_APROVACAO','EM_ANALISE')), 0) AS valor_total_em_aprovacao,
    COALESCE(SUM(valor_estimado) FILTER (WHERE status = 'APROVADO'), 0)  AS valor_total_aprovado
FROM solicitacoes;

-- =====================================================================
-- DADOS INICIAIS (seed) - usuário admin padrão
-- Senha: Admin@123  (hash bcrypt gerado no backend/scripts/seed.js)
-- =====================================================================
-- INSERT INTO usuarios (nome, email, senha_hash, perfil, departamento)
-- VALUES ('Administrador', 'admin@empresa.com', '<hash_bcrypt>', 'ADMIN', 'TI');
