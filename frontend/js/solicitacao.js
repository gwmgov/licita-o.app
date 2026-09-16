exigirAutenticacao();
exibirUsuarioLogado();

let passoAtual = 1;
const TOTAL_PASSOS = 4;
let arquivosSelecionados = [];

const form = document.getElementById('form-solicitacao');
const erroEl = document.getElementById('erro-form');

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
    if (['srp', 'apresentar_prototipo', 'seguro_garantia', 'transformacao'].includes(chave)) {
      dados[chave] = valor === 'true';
    } else {
      dados[chave] = valor === '' ? null : valor;
    }
  }
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
