const db = require('../db/connection');

exports.getAllUsers = (req, res) => {
  db.query('SELECT * FROM users', (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results);
  });
};


exports.getUserById = (req, res) => {
  const { id } = req.params;

  db.query('SELECT * FROM users WHERE user_id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor', details: err });
    if (results.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

    res.json(results[0]);
  });
};


exports.createUser = (req, res) => {
  const { name, user_email } = req.body;
  db.query('INSERT INTO users (name, user_email) VALUES (?, ?)', [name, user_email], (err, result) => {
    if (err) return res.status(500).json(err);
    res.status(201).json({ id: result.insertId, name, user_email });
  });
};

exports.deleteUser = (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM users WHERE user_id = ?', [id], (err) => {
    if (err) return res.status(500).json(err);
    res.status(204).end();
  });
};

exports.updateUser = (req, res) => {
  const { id } = req.params;
  const { name, user_email } = req.body;
  db.query('UPDATE users SET name = ?, user_email = ? WHERE user_id = ?', [name, user_email, id], (err) => {
    if (err) return res.status(500).json(err);
    res.json({ id, name, user_email });
  });
};

exports.updateUserPartial = (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  if (!id) return res.status(400).json({ error: 'ID do usuário é obrigatório.' });

  const keys = Object.keys(fields);
  const values = Object.values(fields);

  if (keys.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
  }

  const setClause = keys.map(key => `${key} = ?`).join(', ');
  const sql = `UPDATE users SET ${setClause} WHERE user_id = ?`;

  db.query(sql, [...values, id], (err, result) => {
    if (err) return res.status(500).json(err);
    res.json({ message: 'Usuário atualizado com sucesso.' });
  });
};
