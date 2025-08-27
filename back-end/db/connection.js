const mysql = require('mysql2');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1111',       
  database: 'roll'
});

db.connect((err) => {
  if (err) {
    console.error('Erro na conexão com o MySQL:', err);
    return;
  }
  console.log('Conectado ao MySQL!');
});

module.exports = db;
