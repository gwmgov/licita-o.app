const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const extensoesPermitidas = (process.env.ALLOWED_FILE_TYPES || '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.zip')
  .split(',')
  .map((e) => e.trim().toLowerCase());

const tamanhoMaximo = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 15) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    // Nome de arquivo sanitizado e único, evitando path traversal e colisões
    const ext = path.extname(file.originalname).toLowerCase();
    const nomeUnico = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, nomeUnico);
  }
});

function filtroArquivo(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!extensoesPermitidas.includes(ext)) {
    return cb(new Error(`Tipo de arquivo não permitido: ${ext}`));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter: filtroArquivo,
  limits: { fileSize: tamanhoMaximo, files: 10 }
});

module.exports = { upload, uploadDir };
