/**
 * Cliente HTTP compartilhado por todas as páginas.
 * Centraliza a base URL, o token JWT e o tratamento padrão de erros.
 */
const API = {
  baseUrl: window.API_BASE_URL
    || (window.location.origin.includes('5500') || window.location.protocol === 'file:'
      ? 'http://localhost:3000/api'
      : '/api'),

  token() {
    return localStorage.getItem('licitacoes_token');
  },

  usuario() {
    const dados = localStorage.getItem('licitacoes_usuario');
    return dados ? JSON.parse(dados) : null;
  },

  async requisitar(caminho, { metodo = 'GET', corpo = null, arquivo = false } = {}) {
    const cabecalhos = {};
    if (!arquivo) cabecalhos['Content-Type'] = 'application/json';
    if (this.token()) cabecalhos['Authorization'] = `Bearer ${this.token()}`;

    const resposta = await fetch(`${this.baseUrl}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: arquivo ? corpo : corpo ? JSON.stringify(corpo) : undefined
    });

    if (resposta.status === 401) {
      localStorage.removeItem('licitacoes_token');
      localStorage.removeItem('licitacoes_usuario');
      window.location.href = 'index.html';
      throw new Error('Sessão expirada.');
    }

    const isJson = resposta.headers.get('content-type')?.includes('application/json');
    const dados = isJson ? await resposta.json() : null;

    if (!resposta.ok) {
      throw new Error(dados?.erro || 'Erro na requisição.');
    }
    return dados;
  },

  get(caminho) { return this.requisitar(caminho); },
  post(caminho, corpo) { return this.requisitar(caminho, { metodo: 'POST', corpo }); },
  put(caminho, corpo) { return this.requisitar(caminho, { metodo: 'PUT', corpo }); },
  patch(caminho, corpo) { return this.requisitar(caminho, { metodo: 'PATCH', corpo }); },
  del(caminho) { return this.requisitar(caminho, { metodo: 'DELETE' }); },
  upload(caminho, formData) { return this.requisitar(caminho, { metodo: 'POST', corpo: formData, arquivo: true }); }
};

/** Protege páginas que exigem login. Redireciona ao index.html se não autenticado. */
function exigirAutenticacao() {
  if (!API.token()) {
    window.location.href = 'index.html';
  }
}

/** Preenche nome/perfil do usuário logado no rodapé da sidebar, se existir na página. */
function exibirUsuarioLogado() {
  const usuario = API.usuario();
  const nomeEl = document.getElementById('usuario-nome');
  const perfilEl = document.getElementById('usuario-perfil');
  if (usuario && nomeEl) nomeEl.textContent = usuario.nome;
  if (usuario && perfilEl) perfilEl.textContent = ROTULOS_PERFIL[usuario.perfil] || usuario.perfil;
}

function encerrarSessao() {
  localStorage.removeItem('licitacoes_token');
  localStorage.removeItem('licitacoes_usuario');
  window.location.href = 'index.html';
}

const ROTULOS_PERFIL = { SOLICITANTE: 'Solicitante', APROVADOR: 'Aprovador', ADMIN: 'Administrador' };

const ROTULOS_STATUS = {
  RASCUNHO: { texto: 'Rascunho', classe: 'selo-rascunho' },
  PENDENTE_APROVACAO: { texto: 'Pendente de Aprovação', classe: 'selo-pendente' },
  EM_ANALISE: { texto: 'Em Análise', classe: 'selo-analise' },
  APROVADO: { texto: 'Aprovado', classe: 'selo-aprovado' },
  REPROVADO: { texto: 'Reprovado', classe: 'selo-reprovado' },
  CANCELADO: { texto: 'Cancelado', classe: 'selo-cancelado' }
};

function seloStatusHtml(status) {
  const info = ROTULOS_STATUS[status] || { texto: status, classe: 'selo-cancelado' };
  return `<span class="selo-status ${info.classe}">${info.texto}</span>`;
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined) return '-';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
}

function formatarDataHora(data) {
  if (!data) return '-';
  return new Date(data).toLocaleString('pt-BR');
}
