const express = require('express');
const cors = require('cors'); // ← APENAS UMA VEZ!
const app = express();
const userRoutes = require('./routes/users');
const placeRoutes = require('./routes/places');

// Configuração do CORS
app.use(cors({
   origin: ['http://localhost:5500', 'http://127.0.0.1:5500']
}));

// Middleware para JSON
app.use(express.json());

// Rotas
app.use('/users', userRoutes);
app.use('/places', placeRoutes);

// Iniciar servidor
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});