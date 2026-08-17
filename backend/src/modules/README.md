# Backend em camadas

Estrutura modular por dominio:

```text
src/
  middlewares/
    errorHandler.js
    rateLimiter.js
    requestLogger.js
    validate.js
  modules/
    auth/
      auth.routes.js
      authController.js
      authMiddleware.js
      authRoutes.js
      authService.js
    users/
      user.repository.js
      user.routes.js
      user.service.js
      userController.js
      userRoutes.js
      userSchemas.js
      userService.js
    ocs/
      oc.repository.js
      oc.routes.js
      oc.service.js
      ocController.js
      ocRoutes.js
      ocSchemas.js
      ocService.js
    audit/
      audit.repository.js
      auditService.js
    health/
      health.controller.js
      health.repository.js
      health.routes.js
      health.service.js
```

Responsabilidades:

- `*.controller.js`: recebe `req`, chama services e responde com `res`.
- `*.service.js`: concentra regras de negocio, nao depende de Express e recebe repositories por contrato.
- `*.repository.js`: executa SQL e conversa com o banco.
- `I*Repository.js`: declara o contrato explicito que o service usa.
- `in-memory-*.repository.js`: implementacao alternativa para testes sem PostgreSQL.
- `middlewares/`: autenticacao, autorizacao, validacao, rate limit e erros.

Inversao de dependencia:

- `user.service.js` depende de `IUserRepository`, nao de PostgreSQL.
- `oc.service.js` depende de `IOcRepository`, nao de PostgreSQL.
- `userService.js` e `ocService.js` sao adaptadores de compatibilidade que montam as instancias padrao com PostgreSQL.
- Testes podem injetar repositories em memoria sem alterar services.

Exemplo com mock em memoria:

```js
const { createUserService } = require('./users/user.service');
const { createInMemoryUserRepository } = require('./users/in-memory-user.repository');

const userService = createUserService({
  repository: createInMemoryUserRepository(),
  passwordHasher: {
    hash: async (value) => value,
    compare: async (value, storedValue) => value === storedValue
  },
  tokenProvider: {
    sign: (payload) => `token:${payload.id}`
  },
  security: {
    bcryptSaltRounds: 1,
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h'
  }
});
```

Tratamento global de erros:

- Services lancam `AppError` para erros esperados de negocio.
- `validate` transforma erros de schema em `AppError`.
- `errorHandler` normaliza erros da aplicacao, autenticacao e banco.
- Em producao, a resposta nao inclui stack trace.

Formato padrao:

```json
{
  "error": {
    "message": "Senha invalida",
    "code": "VALIDATION_ERROR",
    "status": 400
  }
}
```

Exemplo de uso em service:

```js
const AppError = require('../../utils/AppError');
const ERROR_CODES = require('../../utils/errorCodes');

throw new AppError('Usuario nao encontrado', 404, ERROR_CODES.NOT_FOUND);
```

Exemplo real: `POST /users/login`

1. `user.routes.js` aplica `validate(loginSchema)` e chama `userController.login`.
2. `userController.login` repassa somente `req.body` para `userService.loginUser`.
3. `userService.loginUser` busca usuario, valida senha com bcrypt e gera JWT.
4. `user.repository.js` executa `SELECT * FROM users WHERE login = $1`.
5. A resposta mantem o contrato atual:

```json
{
  "token": "jwt",
  "user": {
    "id": 1,
    "nome": "Admin",
    "role": "admin"
  }
}
```

Exemplo real: cadastro de usuario

1. `POST /users/register` passa por `requireAuth`, `requireRole('admin')` e `validate(registerUserSchema)`.
2. O controller extrai `actor` e `auditContext` do request.
3. O service gera hash da senha, chama `repository.create` e registra auditoria.
4. O repository executa o `INSERT INTO users`.
