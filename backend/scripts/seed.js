const fs = require('fs/promises');
const path = require('path');
const bcrypt = require('bcrypt');
const pool = require('../src/config/db');
const { bcryptSaltRounds } = require('../src/config/security');
const { EMPRESAS_FIXAS } = require('../src/modules/empresas/empresaConstants');

const seedsDir = path.resolve(__dirname, '../seeds');

const seedEmpresas = EMPRESAS_FIXAS;

const seedUsers = [
  {
    nome: 'Administrador',
    login: 'admin',
    passwordEnv: 'SEED_ADMIN_PASSWORD',
    defaultPassword: 'admin123',
    role: 'admin',
    nivel_estoquista: null
  },
  {
    nome: 'Gestor',
    login: 'gestor',
    passwordEnv: 'SEED_GESTOR_PASSWORD',
    defaultPassword: 'gestor123',
    role: 'gestor',
    nivel_estoquista: null
  },
  {
    nome: 'Estoquista',
    login: 'estoquista',
    passwordEnv: 'SEED_ESTOQUISTA_PASSWORD',
    defaultPassword: 'estoque123',
    role: 'estoquista',
    nivel_estoquista: 1
  }
];

async function runSqlSeeds(client) {
  const entries = await fs.readdir(seedsDir, { withFileTypes: true }).catch((err) => {
    if (err.code === 'ENOENT') {
      return [];
    }

    throw err;
  });

  const seedFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  for (const fileName of seedFiles) {
    const sql = await fs.readFile(path.join(seedsDir, fileName), 'utf8');
    await client.query(sql);
    console.log(`Seed SQL executado: ${fileName}`);
  }
}

async function upsertSeedEmpresas(client) {
  for (const empresa of seedEmpresas) {
    await client.query(
      `INSERT INTO empresas (id, codigo, nome)
       VALUES ($1, $2, $3)
       ON CONFLICT (codigo) DO UPDATE
       SET nome = EXCLUDED.nome,
           ativo = true`,
      [empresa.id, empresa.codigo, empresa.nome]
    );

    console.log(`Empresa seed garantida: ${empresa.codigo} (${empresa.id})`);
  }
}

async function upsertSeedUsers(client) {
  for (const user of seedUsers) {
    const plainPassword = process.env[user.passwordEnv] || user.defaultPassword;
    const hashedPassword = await bcrypt.hash(plainPassword, bcryptSaltRounds);

    await client.query(
      `INSERT INTO users (nome, login, senha, role, nivel_estoquista)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (login) DO NOTHING`,
      [user.nome, user.login, hashedPassword, user.role, user.nivel_estoquista]
    );

    console.log(`Usuario seed garantido: ${user.login}`);
  }
}

async function upsertSeedUserEmpresas(client) {
  await client.query(
    `INSERT INTO user_empresas (user_id, empresa_id)
     SELECT users.id, empresas.id
     FROM users
     CROSS JOIN empresas
     WHERE users.login = ANY($1)
       AND empresas.codigo = ANY($2)
     ON CONFLICT DO NOTHING`,
    [
      seedUsers.map((user) => user.login),
      seedEmpresas.map((empresa) => empresa.codigo)
    ]
  );

  console.log('Vinculos user_empresas seed garantidos.');
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await runSqlSeeds(client);
    await upsertSeedEmpresas(client);
    await upsertSeedUsers(client);
    await upsertSeedUserEmpresas(client);
    await client.query('COMMIT');
    console.log('Seed concluida.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Erro ao executar seed:', err);
  process.exitCode = 1;
});
