# Frontend

Aplicação React do sistema Estoque Med. O frontend consome a API do backend para autenticação, usuários e OCs, e mantém temporariamente um mock local de produtos.

## Stack

- React 19
- React Router DOM 7
- React Scripts / Create React App
- Fetch API
- CSS por páginas e componentes

## Estrutura

```text
frontend/
  public/
  src/
    components/
    contexts/
    hooks/
    pages/
    services/
    styles/
    App.js
    index.js
  package.json
```

Principais pastas:

- `components`: componentes reutilizáveis, layout, sidebar, usuários, OCs e aprovação.
- `contexts`: contexto de autenticação.
- `hooks`: hooks para autenticação, usuários, produtos e OCs.
- `pages`: telas da aplicação.
- `services`: cliente HTTP e mock temporário de produtos.
- `styles`: estilos separados por tela ou componente.

## Configuração

Crie um arquivo `.env` na pasta `frontend` com a URL da API:

```env
REACT_APP_API_URL=http://localhost:3001
```

Essa variável é usada por `src/services/api.js` para montar as chamadas HTTP.

## Execução

Instale as dependências:

```bash
npm install
```

Inicie o frontend:

```bash
npm start
```

URL local padrão:

```text
http://localhost:3000
```

## Scripts

- `npm start`: inicia a aplicação em desenvolvimento.
- `npm run build`: gera build de produção.
- `npm test`: executa o runner de testes do Create React App.
- `npm run eject`: ejeta a configuração do Create React App.

## Integração com Backend

O frontend possui funções de integração em `src/services/api.js`, incluindo:

- Login e sessão.
- Gestão de usuários.
- Criação de OCs.
- Listagem de OCs por gestor e estoquista.
- Contagem e finalização de OCs.
- Aprovação e envio para recontagem.

As requisições autenticadas enviam o token JWT no header:

```text
Authorization: Bearer <token>
```

## Produtos

O mock de produtos permanece em `src/services/mockProdutos.js` e é utilizado por `getProdutosExterno`. Esse mock é temporário e pode ser substituído futuramente por integração com banco externo ou serviço real de produtos.
