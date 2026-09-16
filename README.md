# Sistema de Solicitação e Aprovação de Participação em Licitações

Aplicação web corporativa para que equipes comerciais cadastrem oportunidades de
licitação, anexem documentos e submetam a solicitação a um fluxo de aprovação
interno, com controle de status, histórico completo e dashboard de indicadores.

---

## 1. Arquitetura da Solução

```
┌─────────────────────┐        HTTPS/JSON        ┌──────────────────────┐        SQL         ┌─────────────────┐
│   Frontend (SPA)    │ ───────────────────────▶ │   Backend (API REST) │ ─────────────────▶ │   PostgreSQL     │
│ HTML5 + Bootstrap 5 │ ◀─────────────────────── │  Node.js + Express    │ ◀───────────────── │ (ou SQL Server/  │
│   + JavaScript       │       JWT no header       │  Camadas: routes →    │                     │  MySQL)          │
└─────────────────────┘                           │ controllers → models  │                     └─────────────────┘
                                                    │  + services (e-mail,  │
                                                    │  integrações M365)    │
                                                    └──────────┬────────────┘
                                                               │
                                                     ┌─────────▼─────────┐
                                                     │  Sistema de        │
                                                     │  arquivos (uploads)│
                                                     └────────────────────┘
```

**Padrão arquitetural:** API REST desacoplada (backend) + SPA leve consumindo a API
(frontend). Isso permite, no futuro, substituir o frontend por um app React/Angular,
ou plugar a mesma API a um conector do Power Automate/Teams sem alterar o backend.

**Camadas do backend (Clean Code / separação de responsabilidades):**
- `routes/` — definição de endpoints e middlewares aplicados (autenticação, validação).
- `controllers/` — orquestram a regra de negócio da requisição HTTP.
- `models/` — acesso a dados via SQL parametrizado (proteção contra SQL Injection).
- `middleware/` — autenticação JWT, controle de perfis, upload seguro, validação de entrada.
- `services/` — integrações externas (e-mail, Power Automate/Teams), isoladas da regra de negócio.

**Tecnologias escolhidas e por quê:**
| Camada | Tecnologia | Justificativa |
|---|---|---|
| Frontend | HTML5 + CSS3 + Bootstrap 5 + JS puro | Requisito do briefing; sem necessidade de build step, fácil manutenção por equipes menores |
| Backend | Node.js + Express | Alta produtividade, ecossistema maduro para APIs REST, fácil integração com Microsoft Graph/Power Automate via HTTP |
| Banco de dados | PostgreSQL | Tipos ENUM nativos, JSONB para auditoria, `gen_random_uuid()`, robustez para regras de negócio via triggers/views. Facilmente adaptável para SQL Server ou MySQL (ver seção 7) |
| Autenticação | JWT + bcrypt | Stateless, escalável horizontalmente, sem necessidade de sessão em servidor |

---

## 2. Estrutura de Pastas

```
licitacoes-app/
├── README.md
├── database/
│   └── schema.sql                 # Script SQL completo (DDL + views + seed)
├── backend/
│   ├── package.json
│   ├── .env.example
│   ├── server.js                  # Ponto de entrada, segurança global
│   ├── config/
│   │   └── db.js                  # Pool de conexão PostgreSQL
│   ├── middleware/
│   │   ├── auth.js                # JWT + controle de perfis
│   │   ├── upload.js              # Multer com validação de tipo/tamanho
│   │   └── validation.js          # express-validator
│   ├── models/
│   │   ├── Usuario.js
│   │   ├── Solicitacao.js
│   │   ├── Anexo.js
│   │   └── HistoricoAprovacao.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── solicitacaoController.js
│   │   └── anexoController.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── solicitacaoRoutes.js
│   │   ├── anexoRoutes.js
│   │   └── usuarioRoutes.js
│   ├── services/
│   │   ├── emailService.js        # Notificações por e-mail
│   │   └── integracaoService.js   # Webhook Power Automate (extensível a Teams/SharePoint)
│   ├── scripts/
│   │   └── seed.js                # Cria usuários iniciais (admin/aprovador/solicitante)
│   └── uploads/                   # Armazenamento físico dos anexos (gerado em runtime)
└── frontend/
    ├── index.html                 # Tela de login
    ├── dashboard.html             # Indicadores
    ├── nova-solicitacao.html      # Formulário em etapas (wizard)
    ├── consulta.html              # Pesquisa e filtros com paginação
    ├── aprovacao.html             # Fila de aprovação + tela de decisão
    ├── css/style.css
    └── js/
        ├── api.js                 # Cliente HTTP + helpers de formatação/sessão
        ├── dashboard.js
        ├── solicitacao.js
        ├── consulta.js
        └── aprovacao.js
```

---

## 3. Modelagem do Banco de Dados

Tabelas principais (script completo em `database/schema.sql`):

- **usuarios** — cadastro, perfil (`SOLICITANTE`, `APROVADOR`, `ADMIN`), status ativo/inativo.
- **solicitacoes** — todos os campos da licitação, status (ENUM), dados do solicitante e do aprovador, protocolo único gerado automaticamente (`SOL-AAAA-NNNNNN`).
- **anexos** — arquivos vinculados a cada solicitação (nome, caminho, tipo, tamanho, quem enviou).
- **historico_aprovacoes** — cada ação do fluxo (criação, edição, envio, análise, aprovação, reprovação, ajuste, cancelamento), com status anterior/novo e observação.
- **auditoria** — log genérico de eventos de segurança/acesso (JSONB para detalhes).
- **vw_dashboard_indicadores** — view que consolida os contadores e valores para o dashboard, evitando lógica de agregação duplicada no backend.

Todas as chaves primárias usam `UUID`, evitando enumeração sequencial de registros
(boa prática de segurança) e facilitando futura sincronização com sistemas externos
(SharePoint/Dataverse).

---

## 4. Fluxo de Aprovação (implementado)

```
RASCUNHO ──envia──▶ PENDENTE_APROVACAO ──inicia análise──▶ EM_ANALISE ──┬─▶ APROVADO
                              ▲                                          ├─▶ REPROVADO
                              └───────── solicitar ajustes ──────────────┘
Qualquer status (exceto finalizado) ──▶ CANCELADO
```

Cada transição grava uma linha em `historico_aprovacoes` com usuário, timestamp,
status anterior/novo e observação — atendendo ao requisito de rastreabilidade total.

---

## 5. API REST — principais endpoints

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| POST | `/api/auth/login` | Autenticação, retorna JWT | Público |
| POST | `/api/auth/registrar` | Cria novo usuário | ADMIN |
| POST | `/api/solicitacoes` | Cria solicitação (rascunho) | Autenticado |
| PUT | `/api/solicitacoes/:id` | Edita solicitação | Autenticado |
| POST | `/api/solicitacoes/:id/enviar` | Envia para aprovação | Autenticado |
| GET | `/api/solicitacoes` | Pesquisa paginada com filtros | Autenticado |
| GET | `/api/solicitacoes/:id` | Detalhe + anexos + histórico | Autenticado |
| GET | `/api/solicitacoes/dashboard` | Indicadores agregados | Autenticado |
| POST | `/api/solicitacoes/:id/iniciar-analise` | Move para Em Análise | APROVADOR/ADMIN |
| POST | `/api/solicitacoes/:id/aprovar` | Aprova | APROVADOR/ADMIN |
| POST | `/api/solicitacoes/:id/reprovar` | Reprova (motivo obrigatório) | APROVADOR/ADMIN |
| POST | `/api/solicitacoes/:id/solicitar-ajustes` | Devolve para Rascunho | APROVADOR/ADMIN |
| POST | `/api/anexos/:solicitacaoId/upload` | Upload de múltiplos arquivos | Autenticado |
| GET | `/api/anexos/download/:id` | Download de um anexo | Autenticado |

---

## 6. Segurança implementada

- **Autenticação:** JWT assinado, expiração configurável (`JWT_EXPIRES_IN`).
- **Senhas:** hash com `bcrypt` (custo 12), nunca armazenadas em texto puro.
- **Perfis de acesso:** middleware `autorizar()` restringe rotas sensíveis por perfil.
- **SQL Injection:** 100% das queries usam parâmetros (`$1, $2...`), nunca concatenação de strings.
- **Sanitização/validação de entrada:** `express-validator` nos campos numéricos, booleanos e textuais.
- **Upload seguro:** whitelist de extensões, limite de tamanho (`MAX_FILE_SIZE_MB`), nomes de arquivo re-gerados (evita path traversal e colisão).
- **Cabeçalhos HTTP:** `helmet` aplicado globalmente.
- **Rate limiting:** limite geral por IP e limite mais restrito no endpoint de login (proteção contra brute-force).
- **Auditoria:** tabela `auditoria` disponível para registro de eventos sensíveis (login, exclusões, downloads).
- **CORS:** restrito à origem do frontend em produção (`FRONTEND_URL`).

---

## 7. Instruções de Implantação

### 7.1 Pré-requisitos
- Node.js 18+
- PostgreSQL 14+ (ou adapte `config/db.js` e `schema.sql` para SQL Server/MySQL)

### 7.2 Banco de dados
```bash
createdb licitacoes_db
psql -d licitacoes_db -f database/schema.sql
```

### 7.3 Backend
```bash
cd backend
cp .env.example .env      # edite com suas credenciais reais
npm install
npm run seed               # cria usuários de exemplo (senha: Admin@123)
npm start                  # ou "npm run dev" com nodemon em desenvolvimento
```
A API sobe em `http://localhost:3000` (ajustável via `PORT`).

### 7.4 Frontend
O frontend é estático — pode ser servido por qualquer servidor HTTP:
```bash
cd frontend
npx serve .                # ou: python3 -m http.server 8080
```
Acesse `http://localhost:8080/index.html`.
Em produção, publique os arquivos de `frontend/` em um servidor web (IIS, Nginx,
Azure Static Web Apps, S3 + CloudFront) e configure `FRONTEND_URL` no backend
para o domínio correspondente.

### 7.5 Variáveis de ambiente essenciais em produção
- Gere um `JWT_SECRET` forte e único.
- Configure `SMTP_*` para notificações reais de aprovação.
- Ative `DB_SSL=true` se o banco exigir conexão criptografada (comum em nuvem).

---

## 8. Sugestões de Evolução Futura

1. **Integração com Microsoft Power Automate:** o serviço `integracaoService.js` já
   expõe um ponto único (`POWER_AUTOMATE_WEBHOOK_URL`) para disparar fluxos quando
   uma solicitação muda de status — por exemplo, criar uma aprovação nativa no Power
   Automate/Teams Approvals.
2. **Notificações no Microsoft Teams:** adicionar um webhook de canal do Teams em
   `integracaoService.js`, reaproveitando os mesmos eventos já emitidos.
3. **E-mails via Outlook/Microsoft Graph:** substituir o `nodemailer` por chamadas à
   Microsoft Graph API (`/me/sendMail`), usando uma conta de serviço corporativa.
4. **Armazenamento de anexos no SharePoint:** trocar o `multer` (disco local) por
   upload direto para uma biblioteca de documentos do SharePoint via Microsoft Graph,
   mantendo a URL do documento na tabela `anexos`.
5. **Login único (SSO) com Azure AD/Entra ID:** substituir o login local por OAuth2/OIDC
   corporativo, mapeando grupos do Azure AD para os perfis `SOLICITANTE`/`APROVADOR`/`ADMIN`.
6. **Aprovação móvel:** expor as ações de aprovação como Adaptive Cards no Teams,
   permitindo aprovar/reprovar sem abrir o sistema.
7. **Relatórios avançados:** dashboard com gráficos (Chart.js) por período, órgão e UF.
8. **Assinatura eletrônica** do termo de aprovação para valores acima de determinado teto.
9. **Testes automatizados:** suíte de testes de integração (Jest + Supertest) cobrindo
   o fluxo de status ponta a ponta.
10. **Containerização:** `Dockerfile` + `docker-compose.yml` (API + PostgreSQL) para
    padronizar ambientes de desenvolvimento e homologação.

---

## 9. Credenciais de exemplo (após `npm run seed`)

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | admin@empresa.com | Admin@123 |
| Aprovador | maria.aprovadora@empresa.com | Admin@123 |
| Solicitante | joao.solicitante@empresa.com | Admin@123 |

> Troque essas senhas imediatamente em qualquer ambiente real.
