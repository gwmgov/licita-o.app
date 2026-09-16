const path = require('path');
const fs = require('fs');
const Anexo = require('../models/Anexo');
const { uploadDir } = require('../middleware/upload');

async function uploadAnexos(req, res) {
  try {
    const { solicitacaoId } = req.params;
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });
    }

    const anexosCriados = [];
    for (const file of req.files) {
      const anexo = await Anexo.criar({
        solicitacaoId,
        nomeArquivo: file.originalname,
        caminhoArquivo: file.filename,
        tipoArquivo: file.mimetype,
        tamanhoBytes: file.size,
        enviadoPor: req.usuario.id
      });
      anexosCriados.push(anexo);
    }

    res.status(201).json(anexosCriados);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao enviar anexos.' });
  }
}

async function listarPorSolicitacao(req, res) {
  const anexos = await Anexo.listarPorSolicitacao(req.params.solicitacaoId);
  res.json(anexos);
}

async function download(req, res) {
  try {
    const anexo = await Anexo.buscarPorId(req.params.id);
    if (!anexo) return res.status(404).json({ erro: 'Anexo não encontrado.' });

    const caminhoCompleto = path.join(uploadDir, anexo.caminho_arquivo);
    if (!fs.existsSync(caminhoCompleto)) {
      return res.status(404).json({ erro: 'Arquivo físico não encontrado.' });
    }

    res.download(caminhoCompleto, anexo.nome_arquivo);
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao baixar anexo.' });
  }
}

async function excluir(req, res) {
  try {
    const anexo = await Anexo.buscarPorId(req.params.id);
    if (!anexo) return res.status(404).json({ erro: 'Anexo não encontrado.' });

    const caminhoCompleto = path.join(uploadDir, anexo.caminho_arquivo);
    if (fs.existsSync(caminhoCompleto)) fs.unlinkSync(caminhoCompleto);

    await Anexo.excluir(req.params.id);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao excluir anexo.' });
  }
}

module.exports = { uploadAnexos, listarPorSolicitacao, download, excluir };
