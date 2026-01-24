// ========== INSTAGRAM ANALYZER - EXPRESS SERVER ==========

const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rotas
const profileRoutes = require('./routes/profile');
const downloadRoutes = require('./routes/download');

const app = express();
const PORT = process.env.PORT || 3002;

// ========== MIDDLEWARES ==========

// CORS
app.use(cors({
  origin: ['http://localhost:3002', 'http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// Parse JSON
app.use(express.json());

// Servir arquivos estaticos (frontend)
app.use(express.static(path.join(__dirname, '../public')));

// Log de requisicoes
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ========== ROTAS ==========

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', profileRoutes);
app.use('/api', downloadRoutes);

// Rota principal - serve o frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint nao encontrado' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    details: err.message,
  });
});

// ========== INICIAR SERVIDOR ==========

app.listen(PORT, () => {
  console.log('');
  console.log('========================================');
  console.log('   Instagram Analyzer - Server');
  console.log('========================================');
  console.log('');
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
  console.log('');
  console.log('Endpoints disponiveis:');
  console.log('  GET  /health                    - Health check');
  console.log('  GET  /api/videos                - Buscar videos do banco');
  console.log('  POST /api/refresh               - Atualizar do Instagram');
  console.log('  GET  /api/download              - Download de video');
  console.log('========================================');
  console.log('');
});
