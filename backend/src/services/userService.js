const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const createHttpError = require('../utils/createHttpError');
const {
  bcryptSaltRounds,
  jwtSecret,
  jwtExpiresIn
} = require('../config/security');

async function registerUser({ nome, login, senha, role }) {
  try {
    const hashedPassword = await bcrypt.hash(senha, bcryptSaltRounds);

    const result = await pool.query(
      'INSERT INTO users (nome, login, senha, role) VALUES ($1, $2, $3, $4) RETURNING id, nome, login, role',
      [nome, login, hashedPassword, role]
    );

    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw createHttpError(400, 'Login j\u00e1 existe');
    }

    throw err;
  }
}

async function loginUser({ login, senha }) {
  const result = await pool.query(
    'SELECT * FROM users WHERE login = $1',
    [login]
  );

  if (result.rows.length === 0) {
    throw createHttpError(400, 'Usu\u00e1rio n\u00e3o encontrado');
  }

  const user = result.rows[0];
  const senhaValida = await bcrypt.compare(senha, user.senha);

  if (!senhaValida) {
    throw createHttpError(400, 'Senha inv\u00e1lida');
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    jwtSecret,
    { expiresIn: jwtExpiresIn }
  );

  return {
    token,
    user: {
      id: user.id,
      nome: user.nome,
      role: user.role
    }
  };
}

async function listUsers() {
  const result = await pool.query(
    'SELECT id, nome, login, role FROM users ORDER BY nome ASC'
  );

  return result.rows;
}

async function updateUser({ id, nome, login, role, senha }) {
  try {
    const currentUser = await pool.query(
      'SELECT id FROM users WHERE id = $1',
      [id]
    );

    if (currentUser.rows.length === 0) {
      throw createHttpError(404, 'Usu\u00e1rio n\u00e3o encontrado');
    }

    let query;
    let values;

    if (senha && senha.trim()) {
      const hashedPassword = await bcrypt.hash(senha, bcryptSaltRounds);
      query = `
        UPDATE users
        SET nome = $1, login = $2, role = $3, senha = $4
        WHERE id = $5
        RETURNING id, nome, login, role
      `;
      values = [nome, login, role, hashedPassword, id];
    } else {
      query = `
        UPDATE users
        SET nome = $1, login = $2, role = $3
        WHERE id = $4
        RETURNING id, nome, login, role
      `;
      values = [nome, login, role, id];
    }

    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (err) {
    if (err.code === '23505') {
      throw createHttpError(400, 'Login j\u00e1 existe');
    }

    throw err;
  }
}

async function deleteUser({ id, loggedUserId }) {
  if (Number(id) === loggedUserId) {
    throw createHttpError(400, 'Voc\u00ea n\u00e3o pode excluir seu pr\u00f3prio usu\u00e1rio');
  }

  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      throw createHttpError(404, 'Usu\u00e1rio n\u00e3o encontrado');
    }

    return { message: 'Usu\u00e1rio exclu\u00eddo com sucesso' };
  } catch (err) {
    if (err.code === '23503') {
      throw createHttpError(
        400,
        'N\u00e3o foi poss\u00edvel excluir este usu\u00e1rio porque ele possui registros vinculados'
      );
    }

    throw err;
  }
}

async function listEstoquistas() {
  const result = await pool.query(
    "SELECT id, nome FROM users WHERE role = 'estoquista' ORDER BY nome ASC"
  );

  return result.rows;
}

module.exports = {
  registerUser,
  loginUser,
  listUsers,
  updateUser,
  deleteUser,
  listEstoquistas
};
