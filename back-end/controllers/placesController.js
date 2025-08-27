const db = require('../db/connection');

// Função de debug - atualizada para duas tabelas
exports.debugTagSearch = (req, res) => {
  const { tag } = req.query;
  
  const sql = `
    SELECT 
      pp.place_id, pp.place_name, pp.tags, pp.opening_hours, pp.closing_hours,
      pp.street, pp.street_number, pp.phone_number,
      pr.owner_name, pr.owner_cpf, pr.razao_social, pr.cnpj
    FROM places_public pp
    LEFT JOIN places_private pr ON pp.place_id = pr.place_id
  `;
  
  db.query(sql, [], (err, allResults) => {
    if (err) return res.status(500).json(err);
    
    const matchingPlaces = allResults.filter(place => {
      if (!tag) return true;
      
      const placeTags = (place.tags || '').toLowerCase();
      const searchTag = tag.toLowerCase();
      const matches = placeTags.includes(searchTag);
      
      return matches;
    });
    
    res.json({
      tag_searched: tag,
      total_places_in_db: allResults.length,
      matching_places: matchingPlaces.length,
      debug_info: allResults.map(place => ({
        id: place.place_id,
        name: place.place_name,
        tags: place.tags,
        matches: tag ? (place.tags || '').toLowerCase().includes(tag.toLowerCase()) : true
      })),
      results: matchingPlaces
    });
  });
};

// Lista todos as informações de todos os estabelecimentos (completa)
exports.getAllPlaces = (req, res) => {
  const { tag } = req.query;

  let sql = `
    SELECT 
      pp.place_id, pp.place_name, pp.tags, pp.opening_hours, pp.closing_hours,
      pp.street, pp.street_number, pp.phone_number,
      pr.owner_name, pr.owner_cpf, pr.razao_social, pr.cnpj
    FROM places_public pp
    LEFT JOIN places_private pr ON pp.place_id = pr.place_id
  `;
  let params = [];

  if (tag) {
    sql += ' WHERE LOWER(pp.tags) LIKE LOWER(?)';
    params.push(`%${tag}%`);
  }

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json(err);
    
    console.log('📊 Resultados encontrados:', results.length);
    res.json(results);
  });
};

// Cards página com lista de estabelecimentos - usando apenas dados públicos
exports.getPlacesForCards = (req, res) => {
  const { tag } = req.query;
  
  let sql = `
    SELECT place_id, place_name, opening_hours, closing_hours, street, street_number, tags
    FROM places_public
  `;
  let params = [];

  // Filtro por tag
  if (tag) {
    sql += ' WHERE LOWER(tags) LIKE LOWER(?)';
    params.push(`%${tag}%`);
  }

  // Filtrar apenas registros válidos
  sql += ` 
    ${tag ? 'AND' : 'WHERE'} place_name IS NOT NULL 
    AND place_name != '' 
    AND street IS NOT NULL 
    AND street != ''
    ORDER BY place_name
  `;

  db.query(sql, params, (err, results) => {
    if (err) {
      console.error('❌ Erro na query cards:', err);
      return res.status(500).json(err);
    }
    
    console.log('🎴 Cards encontrados:', results.length);
    
    // Log detalhado dos resultados
    results.forEach((place, i) => {
      console.log(`${i+1}. ${place.place_name} - tags: "${place.tags}"`);
    });
    
    res.json(results);
  });
};

// Busca por ID com dados completos (público + privado)
exports.getPlaceById = (req, res) => {
  const { id } = req.params;
  
  const sql = `
    SELECT 
      pp.place_id, pp.place_name, pp.tags, pp.opening_hours, pp.closing_hours,
      pp.street, pp.street_number, pp.phone_number,
      pr.owner_name, pr.owner_cpf, pr.razao_social, pr.cnpj
    FROM places_public pp
    LEFT JOIN places_private pr ON pp.place_id = pr.place_id
    WHERE pp.place_id = ?
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json(err);
    res.json(results[0]);
  });
};

// Criar estabelecimento - inserindo em ambas as tabelas
exports.createPlace = (req, res) => {
  const {
    place_name, tags, opening_hours, closing_hours,
    street, street_number, phone_number,
    razao_social, cnpj, owner_name, owner_cpf
  } = req.body;

  // Começar transação
  db.beginTransaction((err) => {
    if (err) return res.status(500).json(err);

    // Inserir dados públicos primeiro
    const publicQuery = `
      INSERT INTO places_public (place_name, tags, opening_hours, closing_hours, 
        street, street_number, phone_number)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const publicValues = [place_name, tags, opening_hours, closing_hours, 
      street, street_number, phone_number];

    db.query(publicQuery, publicValues, (err, result) => {
      if (err) {
        return db.rollback(() => {
          res.status(500).json(err);
        });
      }

      const placeId = result.insertId;

      // Se há dados privados, inserir na tabela private
      if (owner_name || owner_cpf || razao_social || cnpj) {
        const privateQuery = `
          INSERT INTO places_private (place_id, owner_name, owner_cpf, razao_social, cnpj)
          VALUES (?, ?, ?, ?, ?)
        `;

        const privateValues = [placeId, owner_name, owner_cpf, razao_social, cnpj];

        db.query(privateQuery, privateValues, (err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json(err);
            });
          }

          // Commit da transação
          db.commit((err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json(err);
              });
            }
            res.status(201).json({ id: placeId, place_name });
          });
        });
      } else {
        // Se não há dados privados, só commit
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json(err);
            });
          }
          res.status(201).json({ id: placeId, place_name });
        });
      }
    });
  });
};

// Atualizar estabelecimento - atualiza ambas as tabelas
exports.updatePlace = (req, res) => {
  const { id } = req.params;
  const {
    place_name, tags, opening_hours, closing_hours,
    street, street_number, phone_number,
    razao_social, cnpj, owner_name, owner_cpf
  } = req.body;

  // Separar campos públicos e privados
  const publicFields = {};
  const privateFields = {};

  if (place_name !== undefined) publicFields.place_name = place_name;
  if (tags !== undefined) publicFields.tags = tags;
  if (opening_hours !== undefined) publicFields.opening_hours = opening_hours;
  if (closing_hours !== undefined) publicFields.closing_hours = closing_hours;
  if (street !== undefined) publicFields.street = street;
  if (street_number !== undefined) publicFields.street_number = street_number;
  if (phone_number !== undefined) publicFields.phone_number = phone_number;

  if (owner_name !== undefined) privateFields.owner_name = owner_name;
  if (owner_cpf !== undefined) privateFields.owner_cpf = owner_cpf;
  if (razao_social !== undefined) privateFields.razao_social = razao_social;
  if (cnpj !== undefined) privateFields.cnpj = cnpj;

  db.beginTransaction((err) => {
    if (err) return res.status(500).json(err);

    let completedOperations = 0;
    const totalOperations = (Object.keys(publicFields).length > 0 ? 1 : 0) + 
                           (Object.keys(privateFields).length > 0 ? 1 : 0);

    if (totalOperations === 0) {
      return db.rollback(() => {
        res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
      });
    }

    const checkCompletion = () => {
      completedOperations++;
      if (completedOperations === totalOperations) {
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json(err);
            });
          }
          res.json({ message: 'Estabelecimento atualizado' });
        });
      }
    };

    // Atualizar dados públicos se necessário
    if (Object.keys(publicFields).length > 0) {
      const publicSetClause = Object.keys(publicFields).map(key => `${key} = ?`).join(', ');
      const publicValues = [...Object.values(publicFields), id];

      db.query(`UPDATE places_public SET ${publicSetClause} WHERE place_id = ?`, publicValues, (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json(err);
          });
        }
        checkCompletion();
      });
    }

    // Atualizar dados privados se necessário
    if (Object.keys(privateFields).length > 0) {
      const privateSetClause = Object.keys(privateFields).map(key => `${key} = ?`).join(', ');
      const privateValues = [...Object.values(privateFields), id];

      // Primeiro verificar se já existe registro privado
      db.query('SELECT place_id FROM places_private WHERE place_id = ?', [id], (err, results) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json(err);
          });
        }

        if (results.length > 0) {
          // Atualizar registro existente
          db.query(`UPDATE places_private SET ${privateSetClause} WHERE place_id = ?`, privateValues, (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json(err);
              });
            }
            checkCompletion();
          });
        } else {
          // Inserir novo registro privado
          const insertQuery = `INSERT INTO places_private (${Object.keys(privateFields).join(', ')}, place_id) VALUES (${Object.keys(privateFields).map(() => '?').join(', ')}, ?)`;
          db.query(insertQuery, privateValues, (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json(err);
              });
            }
            checkCompletion();
          });
        }
      });
    }
  });
};

// Atualização parcial - adaptada para duas tabelas
exports.updatePlacePartial = (req, res) => {
  const { id } = req.params;
  const fields = req.body;

  if (!id) return res.status(400).json({ error: 'ID do estabelecimento é obrigatório.' });

  const keys = Object.keys(fields);
  if (keys.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo fornecido para atualização.' });
  }

  // Separar campos públicos e privados
  const publicFields = {};
  const privateFields = {};

  keys.forEach(key => {
    if (['place_name', 'tags', 'opening_hours', 'closing_hours', 'street', 'street_number', 'phone_number'].includes(key)) {
      publicFields[key] = fields[key];
    } else if (['owner_name', 'owner_cpf', 'razao_social', 'cnpj'].includes(key)) {
      privateFields[key] = fields[key];
    }
  });

  db.beginTransaction((err) => {
    if (err) return res.status(500).json(err);

    let completedOperations = 0;
    const totalOperations = (Object.keys(publicFields).length > 0 ? 1 : 0) + 
                           (Object.keys(privateFields).length > 0 ? 1 : 0);

    const checkCompletion = () => {
      completedOperations++;
      if (completedOperations === totalOperations) {
        db.commit((err) => {
          if (err) {
            return db.rollback(() => {
              res.status(500).json(err);
            });
          }
          res.json({ message: 'Estabelecimento atualizado com sucesso.' });
        });
      }
    };

    // Atualizar dados públicos se necessário
    if (Object.keys(publicFields).length > 0) {
      const publicSetClause = Object.keys(publicFields).map(key => `${key} = ?`).join(', ');
      const publicValues = [...Object.values(publicFields), id];

      db.query(`UPDATE places_public SET ${publicSetClause} WHERE place_id = ?`, publicValues, (err) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json(err);
          });
        }
        checkCompletion();
      });
    }

    // Atualizar dados privados se necessário
    if (Object.keys(privateFields).length > 0) {
      // Verificar se já existe registro privado
      db.query('SELECT place_id FROM places_private WHERE place_id = ?', [id], (err, results) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json(err);
          });
        }

        const privateSetClause = Object.keys(privateFields).map(key => `${key} = ?`).join(', ');
        const privateValues = [...Object.values(privateFields), id];

        if (results.length > 0) {
          // Atualizar registro existente
          db.query(`UPDATE places_private SET ${privateSetClause} WHERE place_id = ?`, privateValues, (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json(err);
              });
            }
            checkCompletion();
          });
        } else {
          // Inserir novo registro privado
          const insertQuery = `INSERT INTO places_private (${Object.keys(privateFields).join(', ')}, place_id) VALUES (${Object.keys(privateFields).map(() => '?').join(', ')}, ?)`;
          db.query(insertQuery, privateValues, (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json(err);
              });
            }
            checkCompletion();
          });
        }
      });
    }
  });
};

// Deletar estabelecimento - CASCADE irá deletar automaticamente dados privados
exports.deletePlace = (req, res) => {
  const { id } = req.params;
  
  // Como há CASCADE, só precisamos deletar da tabela principal
  db.query('DELETE FROM places_public WHERE place_id = ?', [id], (err) => {
    if (err) return res.status(500).json(err);
    res.status(204).end();
  });
};