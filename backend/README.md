# Backend

API Node.js/Express do sistema Estoque Med. O backend concentra autenticacao, autorizacao, usuarios, fluxo de OCs, validacoes, seguranca HTTP, rate limit e acesso ao PostgreSQL.

## Stack

- Node.js
- Express 5
- PostgreSQL com `pg`
- JWT com `jsonwebtoken`
- `bcrypt` para senhas
- `zod` para validacao de entrada
- `helmet` para headers de seguranca
- `express-rate-limit` para protecao contra excesso de requisicoes
- `dotenv` para configuracao por ambiente

## Estrutura

```text
backend/
  src/
    app.js
    server.js
    config/
      db.js
      env.js
      security.js
    middlewares/
    modules/
      auth/
      users/
      ocs/
      shared/
    utils/
  migrations/
  seeds/
  scripts/
  .env.example
  package.json
```

Principais responsabilidades:

- `config`: banco, ambiente e parametros de seguranca.
- `middlewares`: validacao, logs, rate limit e tratamento de erros.
- `modules/auth`: autenticacao JWT e autorizacao por papel.
- `modules/users`: login e gestao de usuarios.
- `modules/ocs`: criacao, contagem, finalizacao, aprovacao e recontagem de OCs.
- `migrations`: scripts SQL versionados para criar a estrutura do PostgreSQL.
- `scripts`: comandos Node.js para aplicar migrations e seed.
- `seeds`: espaco reservado para seeds SQL opcionais.
- `utils`: utilitarios de erro, logger e handlers assincronos.

## Configuracao

Crie um `.env` com base no `.env.example`:

```bash
cp .env.example .env
```

No PowerShell:

```powershell
Copy-Item .env.example .env
```

Variaveis principais:

- `PORT`: porta da API.
- `NODE_ENV`: ambiente de execucao.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: conexao PostgreSQL.
- `JWT_SECRET`: segredo de assinatura dos tokens.
- `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX`: limite geral.
- `LOGIN_RATE_LIMIT_WINDOW_MS` e `LOGIN_RATE_LIMIT_MAX`: limite para login.

## Execucao

Instale as dependencias:

```bash
npm install
```

Execute em desenvolvimento:

```bash
npm run dev
```

Execute em modo padrao:

```bash
npm start
```

API local padrao:

```text
http://localhost:3001
```

Healthcheck:

```text
GET /health
```

O healthcheck retorna `status: ok` quando a API e a conexao com o PostgreSQL estao disponiveis, e `status: degraded` quando a consulta ao banco falha.

## Banco de dados

Crie o banco PostgreSQL indicado em `DB_NAME` no `.env`. Exemplo:

```sql
CREATE DATABASE estoque_med;
```

Depois aplique a estrutura versionada:

```bash
npm run migrate
```

Para criar usuarios minimos de acesso:

```bash
npm run seed
```

Ou execute tudo em uma etapa:

```bash
npm run db:setup
```

Usuarios criados pela seed:

- `admin` / `admin123` com perfil `admin`.
- `gestor` / `gestor123` com perfil `gestor`.
- `estoquista` / `estoque123` com perfil `estoquista`.

As senhas podem ser sobrescritas antes de rodar a seed com as variaveis opcionais `SEED_ADMIN_PASSWORD`, `SEED_GESTOR_PASSWORD` e `SEED_ESTOQUISTA_PASSWORD`.

As migrations executadas ficam registradas em `schema_migrations`. Rodar `npm run migrate` mais de uma vez nao recria tabelas nem reaplica arquivos ja registrados.

## Scripts

- `npm run dev`: inicia `src/server.js` com `nodemon`.
- `npm start`: inicia `src/server.js` com Node.js.
- `npm run migrate`: aplica migrations pendentes no PostgreSQL configurado no `.env`.
- `npm run seed`: garante usuarios iniciais usando hash `bcrypt` compativel com a aplicacao.
- `npm run db:setup`: executa migrations e seed em sequencia.
- `npm test`: executa a suite de testes com Jest.

## Endpoints Principais

Autenticacao e sessao:

- `POST /users/login`
- `GET /protegido`

Usuarios:

- `POST /users/register`
- `GET /users`
- `PUT /users/:id`
- `DELETE /users/:id`
- `GET /users/estoquistas`

OCs:

- `POST /ocs/create-with-items`
- `GET /ocs/minhas/gestor`
- `GET /ocs/gestor/:id`
- `GET /ocs/minhas/estoquista`
- `GET /ocs/estoquista/:id`
- `GET /ocs/aprovacao/minhas`
- `GET /ocs/aprovacao/admin/all`
- `GET /ocs/aprovacao/gestor/:id`
- `GET /ocs/:id/items`
- `POST /ocs/contar`
- `PUT /ocs/:id/finalizar`
- `PUT /ocs/:id/aprovar`
- `PUT /ocs/:id/recontagem`

Infraestrutura:

- `GET /health`
- `GET /`

## Perfis

- `admin`: gerencia usuarios, consulta dados de gestores/estoquistas e atua em aprovacoes.
- `gestor`: cria OCs, acompanha suas OCs e aprova ou solicita recontagem.
- `estoquista`: registra contagens e finaliza OCs atribuidas a ele.

## Seguranca e Regras de Acesso

- Rotas protegidas exigem token JWT no header `Authorization: Bearer <token>`.
- `requireRole` restringe acoes por perfil.
- O servico de OCs valida ownership para impedir acesso indevido a OCs de outros usuarios.
- Entradas sao validadas com schemas `zod`.
- Operacoes criticas usam transacoes no PostgreSQL.
- A API aplica `helmet`, rate limit geral e rate limit especifico para login.

## Observacoes

O backend espera que o banco PostgreSQL ja exista. A estrutura de tabelas da aplicacao e criada pelas migrations versionadas em `migrations/`.
