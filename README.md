# Estoque Med

Sistema web para controle de inventário baseado em Ordens de Contagem (OC), com frontend React, backend Node.js/Express e persistência em PostgreSQL.

## Visão Geral do Sistema

O Estoque Med é uma aplicação criada para apoiar o controle de estoque por meio de contagens organizadas, rastreáveis e revisáveis. O sistema resolve o problema de gerenciar inventários operacionais com diferentes responsabilidades entre quem cria a contagem, quem executa a conferência física e quem revisa os resultados.

Uma Ordem de Contagem (OC) representa uma solicitação formal de conferência de itens do estoque. Ela agrupa produtos que precisam ser contados, define o estoquista responsável pela execução e permite que um gestor acompanhe, aprove ou solicite recontagem dos itens.

O objetivo do projeto é oferecer um fluxo técnico e operacional para:

- Criar OCs com itens selecionados.
- Atribuir contagens a estoquistas.
- Registrar quantidades físicas e lote dos itens.
- Revisar divergências entre saldo do sistema e saldo contado.
- Aprovar a OC ou solicitar recontagem quando necessário.

## Perfis de Usuário

O sistema possui três perfis principais: `admin`, `gestor` e `estoquista`.

### Admin

- Gerencia usuários.
- Lista usuários e estoquistas.
- Visualiza OCs de qualquer usuário.
- Consulta OCs por gestor ou por estoquista.
- Acessa listagens de aprovação.
- Pode aprovar OCs ou enviar itens para recontagem.

### Gestor

- Cria OCs com itens selecionados.
- Define o estoquista responsável pela contagem.
- Visualiza suas próprias OCs.
- Revisa contagens finalizadas.
- Aprova OCs ou solicita recontagem de itens.

### Estoquista

- Visualiza OCs atribuídas a ele.
- Realiza a contagem física dos itens.
- Registra quantidade contada e lote.
- Finaliza a OC para aprovação do gestor.

Além da autorização por perfil, o backend possui verificações de ownership para impedir que usuários acessem ou operem OCs de outros responsáveis quando não permitido.

## Fluxo da Ordem de Contagem

O fluxo principal da OC segue estas etapas:

1. Gestor ou admin cria uma OC com produtos selecionados e define o estoquista responsável.
2. Estoquista visualiza a OC atribuída e realiza a contagem física dos itens.
3. Estoquista registra quantidade, lote e finaliza a OC.
4. A OC passa para o estado de aguardando aprovação.
5. Gestor ou admin revisa os resultados da contagem.
6. Gestor ou admin aprova a OC ou envia itens específicos para recontagem.
7. Quando aprovada, a OC é finalizada.

Estados principais da OC:

- `aberta`: OC criada e disponível para contagem ou recontagem.
- `aguardando_aprovacao`: contagem finalizada pelo estoquista e aguardando revisão.
- `finalizada`: OC aprovada.

Estados principais dos itens:

- `pendente`: item ainda não contado.
- `contado`: item contado pelo estoquista.
- `aprovado`: item aprovado na revisão.
- `recontar`: item enviado para nova contagem.

## Stack Utilizada

Frontend:

- React 19
- React Router DOM 7
- Create React App / React Scripts
- Fetch API para comunicação HTTP
- CSS modularizado por páginas e componentes

Backend:

- Node.js
- Express 5
- PostgreSQL com `pg`
- JWT com `jsonwebtoken`
- Criptografia de senha com `bcrypt`
- Validação com `zod`
- Segurança HTTP com `helmet`
- Rate limit com `express-rate-limit`
- Configuração por ambiente com `dotenv`

Banco de dados:

- PostgreSQL
- Tabelas utilizadas pelo backend incluem usuários, OCs, itens de OC e contagens.

## Estrutura do Projeto

```text
estoque-med/
  backend/
    src/
      app.js
      server.js
      config/
      middlewares/
      modules/
        auth/
        users/
        ocs/
        shared/
      utils/
    .env.example
    package.json
  frontend/
    public/
    src/
      components/
      contexts/
      hooks/
      pages/
      services/
      styles/
    package.json
```

Principais pastas:

- `backend/src/config`: configuração de ambiente, banco e segurança.
- `backend/src/middlewares`: tratamento de erros, logs, rate limit e validação.
- `backend/src/modules/auth`: autenticação JWT e middlewares de autorização.
- `backend/src/modules/users`: cadastro, login, listagem, edição e remoção de usuários.
- `backend/src/modules/ocs`: regras de criação, contagem, aprovação e recontagem de OCs.
- `frontend/src/pages`: telas principais da aplicação.
- `frontend/src/components`: componentes reutilizáveis e componentes de domínio.
- `frontend/src/services`: cliente HTTP e mock temporário de produtos.
- `frontend/src/hooks`: hooks de integração com autenticação, usuários, OCs e produtos.

## Requisitos

- Node.js instalado.
- npm instalado.
- PostgreSQL disponível localmente ou em servidor acessível.
- Banco de dados criado e com a estrutura esperada pelo backend.
- Variáveis de ambiente configuradas no backend.
- Variável `REACT_APP_API_URL` configurada no frontend.

O repositório possui migrations versionadas em `backend/migrations` e scripts para aplicá-las e executar a seed. Crie o banco antes de rodar `npm run migrate`.

## Como Executar Localmente

### Backend

Entre na pasta do backend:

```bash
cd backend
```

Instale as dependências:

```bash
npm install
```

Crie o arquivo `.env` a partir do exemplo:

```bash
cp .env.example .env
```

No Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure as variáveis do `.env` com os dados do PostgreSQL e um segredo JWT seguro.

Inicie em desenvolvimento:

```bash
npm run dev
```

Ou inicie em modo padrão:

```bash
npm start
```

Por padrão, o backend usa a porta `3001`, conforme `backend/.env.example`.

### Frontend

Entre na pasta do frontend:

```bash
cd frontend
```

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` no frontend apontando para a API:

```env
REACT_APP_API_URL=http://localhost:3001
```

Inicie a aplicação:

```bash
npm start
```

O frontend será aberto em:

```text
http://localhost:3000
```

## Variáveis de Ambiente

### Backend

Arquivo de referência: `backend/.env.example`.

```env
PORT=3001
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=nome_do_banco
DB_USER=usuario
DB_PASSWORD=sua_senha

JWT_SECRET=troque_por_um_segredo
JWT_EXPIRES_IN=1d
BCRYPT_SALT_ROUNDS=10
REQUEST_BODY_LIMIT=100kb

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
LOGIN_RATE_LIMIT_WINDOW_MS=900000
LOGIN_RATE_LIMIT_MAX=10

# Em produção, libere explicitamente a origem do frontend, se ele estiver em outra origem.
CORS_ORIGIN=http://localhost:3000
```

Descrição:

- `PORT`: porta em que a API será executada.
- `NODE_ENV`: ambiente da aplicação.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: dados de conexão com o PostgreSQL.
- `JWT_SECRET`: segredo usado para assinar e validar tokens JWT.
- `JWT_EXPIRES_IN`: validade dos tokens JWT (padrão: `1d`).
- `BCRYPT_SALT_ROUNDS`: custo do hash de senha (padrão: `10`).
- `REQUEST_BODY_LIMIT`: tamanho máximo de payload JSON/form (padrão: `100kb`; aceita valores positivos em `b`, `kb` ou `mb`).
- `RATE_LIMIT_WINDOW_MS` e `RATE_LIMIT_MAX`: janela e limite geral de requisições.
- `LOGIN_RATE_LIMIT_WINDOW_MS` e `LOGIN_RATE_LIMIT_MAX`: janela e limite específico para login.
- `CORS_ORIGIN`: lista separada por vírgulas de origens de frontend permitidas. Sem ela, o backend nega requisições cross-origin em produção.

### Frontend

```env
REACT_APP_API_URL=http://localhost:3001
```

Essa variável define a URL base usada pelo cliente HTTP em `frontend/src/services/api.js`.

## Scripts Disponíveis

Backend:

- `npm run dev`: inicia o servidor com `nodemon`.
- `npm start`: inicia o servidor com Node.js.
- `npm run migrate`: aplica migrations pendentes.
- `npm run seed`: executa a seed; em produção exige credenciais de seed explícitas e seguras.

Frontend:

- `npm start`: inicia o app React em desenvolvimento.
- `npm run build`: gera build de produção.
- `npm test`: inicia o runner de testes do Create React App.
- `npm run eject`: ejeta a configuração do Create React App.

## CI

O GitHub Actions executa o workflow de CI a cada `push` e `pull request`. Ele instala as dependências a partir dos lockfiles, executa os testes do backend, executa os testes do frontend sem modo watch e gera o build de produção do frontend. Um job separado inicializa um PostgreSQL 16 descartável, aplica as migrations em banco limpo, verifica uma segunda execução idempotente e executa a integração PostgreSQL. Esse job não executa seed e nunca usa banco ou credenciais de desenvolvimento/produção. O workflow não faz deploy nem auditoria de dependências.

## Endpoints Principais do Backend

## E2E

Os testes E2E usam Playwright com Chromium e exercitam navegador, frontend React, API e PostgreSQL descartável. A autenticação usa somente a fixture fictÃ­cia `e2e_admin` / `E2E-test-only-123`.

Para rodar localmente, use PostgreSQL exclusivo cujo nome termine em `_test`, defina `NODE_ENV=test`, `DB_*` e `JWT_SECRET`, e execute:

```bash
cd backend
npm run migrate
npm run seed:e2e
cd ../frontend
npx playwright install chromium
npm run test:e2e
```

`seed:e2e` aborta se `NODE_ENV` nÃ£o for `test` ou se `DB_NAME` não terminar em `_test`. Nunca use E2E contra banco de desenvolvimento, produção ou ambiente externo. A CI cria um banco separado e publica traces e screenshots somente em falhas.

Base local sugerida:

```text
http://localhost:3001
```

### Auth / Users

- `POST /users/login`
- `POST /users/register`
- `GET /users`
- `PUT /users/:id`
- `DELETE /users/:id`
- `GET /users/estoquistas`

### OC

- `POST /ocs/create-with-items`
- `GET /ocs/minhas/gestor`
- `GET /ocs/minhas/estoquista`
- `GET /ocs/:id/items`
- `POST /ocs/contar`
- `PUT /ocs/:id/finalizar`
- `PUT /ocs/:id/aprovar`
- `PUT /ocs/:id/recontagem`

### Sistema

- `GET /health`
- `GET /`

## Segurança do Sistema

O backend possui proteções e mecanismos de robustez para uso autenticado da API:

- Autenticação com JWT.
- Autorização por papel com `admin`, `gestor` e `estoquista`.
- Validação de dados de entrada com `zod`.
- Verificações de ownership nas operações de OC.
- Rate limiting geral da API.
- Rate limiting específico para login.
- Headers de segurança com `helmet`.
- Logs de requisições.
- Tratamento centralizado de erros.
- Healthcheck com verificação da conexão com PostgreSQL.
- Transações no banco em operações críticas, como criação, contagem, aprovação e recontagem de OCs.

## Estado Atual do Projeto

- O frontend está integrado ao backend atualizado por meio de `frontend/src/services/api.js`.
- A autenticação utiliza token JWT enviado no header `Authorization: Bearer`.
- O módulo de OCs possui fluxo de criação, contagem, finalização, aprovação e recontagem.
- O mock de produtos ainda é utilizado temporariamente em `frontend/src/services/mockProdutos.js`.
- A integração com uma base externa ou serviço real de produtos pode ser adicionada posteriormente.

## Melhorias Futuras

- Adicionar testes automatizados no backend e frontend.
- Integrar produtos com uma fonte real ou banco externo.
- Criar migrations e seeds versionados para o banco.
- Adicionar pipeline de CI/CD.
- Evoluir logs para formato estruturado e observabilidade.
- Documentar contrato de API com OpenAPI/Swagger.

## Como Executar com Docker

O projeto possui um `docker-compose.yml` na raiz com tres servicos:

- `postgres`: banco PostgreSQL com volume persistente.
- `backend`: API Node.js/Express na porta `5000`.
- `frontend`: aplicacao React na porta `3000`.

Para construir e subir todos os containers:

```bash
docker compose up --build
```

Para subir em segundo plano:

```bash
docker compose up -d --build
```

Depois que os containers estiverem rodando, acesse:

```text
Frontend: http://localhost:3000
Backend:  http://localhost:5000
Health:   http://localhost:5000/health
Swagger:  http://localhost:5000/docs
Postgres: localhost:5433
```

As variaveis usadas no ambiente Docker estao configuradas no `docker-compose.yml`.
Dentro da rede Docker, o backend acessa o banco pelo host `postgres`.
No navegador, o frontend usa `REACT_APP_API_URL=http://localhost:5000`, apontando para a porta publicada do backend.
Dentro da rede Docker, o backend continua acessando o PostgreSQL em `postgres:5432`; a porta `5433` e usada apenas para acesso ao banco pelo host.

### Migrations e Seed com Docker

Com os containers rodando, execute as migrations:

```bash
docker compose exec backend npm run migrate
```

Execute o seed:

```bash
docker compose exec backend npm run seed
```

Ou rode os dois em sequencia:

```bash
docker compose exec backend npm run db:setup
```

Usuarios criados pelo seed:

```text
admin / admin123
gestor / gestor123
estoquista / estoque123
```

Para derrubar os containers sem apagar os dados do banco:

```bash
docker compose down
```

Para derrubar os containers e remover o volume do PostgreSQL:

```bash
docker compose down -v
```

## READMEs Complementares

- `backend/README.md`: detalhes de execução, variáveis e endpoints do backend.
- `frontend/README.md`: detalhes de execução, integração e estrutura do frontend.
