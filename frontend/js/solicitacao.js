exigirAutenticacao();
exibirUsuarioLogado();

let passoAtual = 1;
const TOTAL_PASSOS = 4;
let arquivosSelecionados = [];
let contadorItens = 0;

const form = document.getElementById('form-solicitacao');
const erroEl = document.getElementById('erro-form');
const itensContainer = document.getElementById('itens-container');

function criarBlocoItem() {
  contadorItens += 1;
  const id = contadorItens;

  const bloco = document.createElement('div');
  bloco.className = 'painel mb-3 bloco-item';
  bloco.dataset.itemId = id;
  bloco.innerHTML = `
    <div class="d-flex justify-content-between align-items-center mb-2">
      <h6 class="mb-0">Item #${id}</h6>
      <button type="button" class="btn btn-sm btn-outline-danger btn-remover-item">Remover</button>
    </div>
    <div class="row g-3">
      <div class="col-md-4">
        <label class="form-label">Item</label>
        <input type="text" class="form-control" data-campo="item">
      </div>
      <div class="col-md-4">
        <label class="form-label">Modelo</label>
        <input type="text" class="form-control" data-campo="modelo">
      </div>
      <div class="col-md-4">
        <label class="form-label">Versão</label>
        <input type="text" class="form-control" data-campo="versao">
      </div>
      <div class="col-md-3">
        <label class="form-label">M/Y (Ano/Modelo)</label>
        <input type="text" class="form-control" data-campo="m_y" placeholder="Ex.: 2026">
      </div>
      <div class="col-md-3">
        <label class="form-label">Cor</label>
        <input type="text" class="form-control" data-campo="cor">
      </div>
      <div class="col-md-3">
        <label class="form-label">Quantidade</label>
        <input type="number" min="0" class="form-control" data-campo="quantidade">
      </div>
      <div class="col-md-3">
        <label class="form-label">Apresentar Protótipo?</label>
        <select class="form-select" data-campo="apresentar_prototipo">
          <option value="false">Não</option><option value="true">Sim</option>
        </select>
      </div>
      <div class="col-md-6">
        <label class="form-label">Acessórios</label>
        <textarea class="form-control" data-campo="acessorios" rows="2"></textarea>
      </div>
      <div class="col-md-6">
        <label class="form-label">Revisões</label>
        <textarea class="form-control" data-campo="revisoes" rows="2"></textarea>
      </div>
    </div>`;

  bloco.querySelector('.btn-remover-item').addEventListener('click', () => {
    if (itensContainer.querySelectorAll('.bloco-item').length <= 1) {
      alert('É necessário manter ao menos um item na solicitação.');
      return;
    }
    bloco.remove();
  });

  return bloco;
}

document.getElementById('btn-adicionar-item').addEventListener('click', () => {
  itensContainer.appendChild(criarBlocoItem());
});

// Sempre começa com 1 item já visível
itensContainer.appendChild(criarBlocoItem());

function coletarItens() {
  return Array.from(itensContainer.querySelectorAll('.bloco-item')).map((bloco) => {
    const pegar = (campo) => bloco.querySelector(`[data-campo="${campo}"]`).value;
    return {
      item: pegar('item') || null,
      modelo: pegar('modelo') || null,
      versao: pegar('versao') || null,
      m_y: pegar('m_y') || null,
      cor: pegar('cor') || null,
      quantidade: pegar('quantidade') ? Number(pegar('quantidade')) : null,
      apresentar_prototipo: pegar('apresentar_prototipo') === 'true',
      acessorios: pegar('acessorios') || null,
      revisoes: pegar('revisoes') || null
    };
  });
}

function irParaPasso(passo) {
  document.querySelectorAll('.etapa').forEach((el) => el.classList.toggle('ativa', Number(el.dataset.etapa) === passo));
  document.querySelectorAll('.wizard-passos li').forEach((li) => {
    const n = Number(li.dataset.passo);
    li.classList.toggle('ativa', n === passo);
    li.classList.toggle('concluido', n < passo);
  });

  document.getElementById('btn-anterior').style.visibility = passo === 1 ? 'hidden' : 'visible';
  document.getElementById('btn-proximo').textContent = passo === TOTAL_PASSOS ? 'Enviar para Aprovação' : 'Próximo →';
  passoAtual = passo;
  erroEl.style.display = 'none';
}

document.getElementById('btn-anterior').addEventListener('click', () => irParaPasso(Math.max(1, passoAtual - 1)));

document.getElementById('btn-proximo').addEventListener('click', async () => {
  if (passoAtual < TOTAL_PASSOS) {
    irParaPasso(passoAtual + 1);
  } else {
    await salvarSolicitacao({ enviarParaAprovacao: true });
  }
});

document.getElementById('btn-rascunho').addEventListener('click', () => salvarSolicitacao({ enviarParaAprovacao: false }));

document.getElementById('input-anexos').addEventListener('change', (e) => {
  arquivosSelecionados = Array.from(e.target.files);
  document.getElementById('lista-anexos-selecionados').innerHTML = arquivosSelecionados
    .map((f) => `📎 ${f.name} (${(f.size / 1024).toFixed(0)} KB)`)
    .join('<br>');
});

function coletarDadosFormulario() {
  const formData = new FormData(form);
  const dados = {};
  for (const [chave, valor] of formData.entries()) {
    if (['srp', 'seguro_garantia', 'transformacao'].includes(chave)) {
      dados[chave] = valor === 'true';
    } else {
      dados[chave] = valor === '' ? null : valor;
    }
  }
  dados.itens = coletarItens();
  return dados;
}

async function salvarSolicitacao({ enviarParaAprovacao }) {
  erroEl.style.display = 'none';
  try {
    const dados = coletarDadosFormulario();
    const solicitacao = await API.post('/solicitacoes', dados);

    if (arquivosSelecionados.length > 0) {
      const formDataAnexos = new FormData();
      arquivosSelecionados.forEach((f) => formDataAnexos.append('arquivos', f));
      await API.upload(`/anexos/${solicitacao.id}/upload`, formDataAnexos);
    }

    if (enviarParaAprovacao) {
      await API.post(`/solicitacoes/${solicitacao.id}/enviar`, {});
    }

    window.location.href = `aprovacao.html?id=${solicitacao.id}&criada=1`;
  } catch (err) {
    erroEl.textContent = err.message || 'Erro ao salvar a solicitação.';
    erroEl.style.display = 'block';
  }
}
