const env = require('../config/env');

const openApiDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Estoque Med API',
    version: '1.0.0',
    description: 'Documentacao da API do sistema Estoque Med.'
  },
  servers: [
    {
      url: `http://localhost:${env.port}`,
      description: 'Ambiente local'
    }
  ],
  tags: [
    {
      name: 'Sistema',
      description: 'Rotas basicas de status da API'
    },
    {
      name: 'Users/Auth',
      description: 'Autenticacao e gerenciamento de usuarios'
    },
    {
      name: 'OCs',
      description: 'Operacoes de ordens de contagem'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            example: 'ValidationError'
          },
          message: {
            type: 'string',
            example: 'Invalid request data'
          },
          details: {
            type: 'array',
            nullable: true,
            items: {
              type: 'object',
              additionalProperties: true
            },
            example: [
              {
                path: ['body', 'login'],
                message: 'Required'
              }
            ]
          }
        }
      },
      HealthResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'ok'
          },
          environment: {
            type: 'string',
            example: 'development'
          },
          uptime: {
            type: 'number',
            example: 120.45
          },
          timestamp: {
            type: 'string',
            format: 'date-time'
          },
          database: {
            type: 'object',
            properties: {
              status: {
                type: 'string',
                example: 'ok'
              }
            }
          }
        }
      },
      LoginRequest: {
        type: 'object',
        required: ['login', 'senha'],
        properties: {
          login: {
            type: 'string',
            example: 'admin'
          },
          senha: {
            type: 'string',
            example: 'admin123'
          }
        }
      },
      LoginResponse: {
        type: 'object',
        properties: {
          token: {
            type: 'string',
            example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
          },
          user: {
            type: 'object',
            properties: {
              id: {
                type: 'integer',
                example: 1
              },
              nome: {
                type: 'string',
                example: 'Administrador'
              },
              role: {
                type: 'string',
                enum: ['admin', 'gestor', 'estoquista'],
                example: 'admin'
              }
            }
          }
        }
      },
      RegisterUserRequest: {
        type: 'object',
        required: ['nome', 'login', 'senha', 'role'],
        properties: {
          nome: {
            type: 'string',
            example: 'Maria Estoquista'
          },
          login: {
            type: 'string',
            example: 'maria.estoque'
          },
          senha: {
            type: 'string',
            example: 'senha123'
          },
          role: {
            type: 'string',
            enum: ['admin', 'gestor', 'estoquista'],
            example: 'estoquista'
          }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1
          },
          nome: {
            type: 'string',
            example: 'Maria Estoquista'
          },
          login: {
            type: 'string',
            example: 'maria.estoque'
          },
          role: {
            type: 'string',
            enum: ['admin', 'gestor', 'estoquista'],
            example: 'estoquista'
          }
        }
      },
      Estoquista: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 3
          },
          nome: {
            type: 'string',
            example: 'Maria Estoquista'
          }
        }
      },
      OcItemInput: {
        type: 'object',
        required: ['produto', 'saldo_sistema'],
        properties: {
          produto: {
            type: 'string',
            example: 'Dipirona 500mg'
          },
          saldo_sistema: {
            type: 'number',
            example: 120
          },
          endereco: {
            type: 'string',
            example: 'A1-02'
          },
          codigo: {
            type: 'string',
            example: 'MED-001'
          },
          codigo_barras: {
            type: 'string',
            example: '7891234567890'
          },
          validade: {
            type: 'string',
            example: '2027-12-31'
          }
        }
      },
      CreateOcRequest: {
        type: 'object',
        required: ['estoquista_id', 'items'],
        properties: {
          estoquista_id: {
            type: 'integer',
            example: 3
          },
          items: {
            type: 'array',
            minItems: 1,
            items: {
              $ref: '#/components/schemas/OcItemInput'
            }
          }
        }
      },
      Oc: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 10
          },
          codigo: {
            type: 'string',
            example: 'OC-00010'
          },
          gestor_id: {
            type: 'integer',
            example: 2
          },
          estoquista_id: {
            type: 'integer',
            example: 3
          },
          status: {
            type: 'string',
            example: 'aberta'
          },
          qtd: {
            type: 'integer',
            example: 2
          }
        },
        additionalProperties: true
      },
      OcItem: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 25
          },
          oc_id: {
            type: 'integer',
            example: 10
          },
          produto: {
            type: 'string',
            example: 'Dipirona 500mg'
          },
          saldo_sistema: {
            type: 'number',
            example: 120
          },
          saldo_contado: {
            type: 'number',
            nullable: true,
            example: 118
          },
          lote: {
            type: 'string',
            nullable: true,
            example: 'L123'
          },
          diferenca: {
            type: 'number',
            nullable: true,
            example: -2
          },
          status: {
            type: 'string',
            example: 'contado'
          }
        },
        additionalProperties: true
      },
      CountRequest: {
        type: 'object',
        required: ['oc_id', 'quantidade', 'lote'],
        description: 'Use oc_localizacao_id para OCs do modelo novo. Use item_id apenas para compatibilidade com OCs legadas.',
        properties: {
          oc_id: {
            type: 'integer',
            example: 10
          },
          item_id: {
            type: 'integer',
            description: 'Identificador legado de oc_items. Mantido para contagem de OCs antigas.',
            example: 25
          },
          oc_localizacao_id: {
            type: 'integer',
            description: 'Identificador da localizacao da OC no modelo novo.',
            example: 120
          },
          quantidade: {
            type: 'number',
            example: 118
          },
          lote: {
            type: 'string',
            example: 'L123'
          }
        }
      },
      CountResponse: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 41
          },
          oc_id: {
            type: 'integer',
            example: 10
          },
          item_id: {
            type: 'integer',
            nullable: true,
            example: 25
          },
          oc_localizacao_id: {
            type: 'integer',
            nullable: true,
            example: 120
          },
          quantidade: {
            type: 'number',
            example: 118
          },
          lote: {
            type: 'string',
            example: 'L123'
          },
          created_at: {
            type: 'string',
            format: 'date-time'
          }
        },
        additionalProperties: true
      },
      RecountRequest: {
        type: 'object',
        required: ['itemIds'],
        properties: {
          itemIds: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'integer'
            },
            example: [25, 26]
          }
        }
      },
      MessageResponse: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Operacao realizada com sucesso'
          }
        }
      }
    },
    responses: {
      BadRequest: {
        description: 'Requisicao invalida',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      Unauthorized: {
        description: 'Token ausente ou invalido',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      Forbidden: {
        description: 'Usuario sem permissao para executar a acao',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      },
      NotFound: {
        description: 'Recurso nao encontrado',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/ErrorResponse'
            }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Verifica a saude da API e do banco de dados',
        responses: {
          200: {
            description: 'API saudavel',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          },
          503: {
            description: 'API disponivel, mas com dependencia degradada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/HealthResponse'
                }
              }
            }
          }
        }
      }
    },
    '/': {
      get: {
        tags: ['Sistema'],
        summary: 'Retorna uma mensagem simples de status da API',
        responses: {
          200: {
            description: 'API em execucao',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                  example: 'API rodando normalmente'
                }
              }
            }
          }
        }
      }
    },
    '/users/login': {
      post: {
        tags: ['Users/Auth'],
        summary: 'Autentica um usuario e retorna um token JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/LoginRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Login realizado com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginResponse'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          }
        }
      }
    },
    '/users/register': {
      post: {
        tags: ['Users/Auth'],
        summary: 'Cadastra um novo usuario',
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RegisterUserRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Usuario cadastrado',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/User'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/users': {
      get: {
        tags: ['Users/Auth'],
        summary: 'Lista usuarios',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Lista de usuarios',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/User'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/users/estoquistas': {
      get: {
        tags: ['Users/Auth'],
        summary: 'Lista usuarios com perfil de estoquista',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Lista de estoquistas',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Estoquista'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          }
        }
      }
    },
    '/ocs/create-with-items': {
      post: {
        tags: ['OCs'],
        summary: 'Cria uma ordem de contagem com itens',
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CreateOcRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'OC criada com sucesso',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Oc'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/minhas/gestor': {
      get: {
        tags: ['OCs'],
        summary: 'Lista OCs do gestor autenticado',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Lista de OCs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Oc'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/minhas/estoquista': {
      get: {
        tags: ['OCs'],
        summary: 'Lista OCs do estoquista autenticado',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Lista de OCs',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Oc'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/aprovacao/minhas': {
      get: {
        tags: ['OCs'],
        summary: 'Lista OCs aguardando aprovacao para o usuario autenticado',
        security: [
          {
            bearerAuth: []
          }
        ],
        responses: {
          200: {
            description: 'Lista de OCs para aprovacao',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Oc'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/{id}/items': {
      get: {
        tags: ['OCs'],
        summary: 'Lista os itens de uma OC',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer'
            },
            example: 10
          }
        ],
        responses: {
          200: {
            description: 'Lista de itens da OC',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/OcItem'
                  }
                }
              }
            }
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          },
          404: {
            $ref: '#/components/responses/NotFound'
          }
        }
      }
    },
    '/ocs/contar': {
      post: {
        tags: ['OCs'],
        summary: 'Registra a contagem de um item de OC',
        security: [
          {
            bearerAuth: []
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/CountRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Contagem registrada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CountResponse'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/{id}/finalizar': {
      put: {
        tags: ['OCs'],
        summary: 'Finaliza uma OC e envia para aprovacao',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer'
            },
            example: 10
          }
        ],
        responses: {
          200: {
            description: 'OC enviada para aprovacao',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    {
                      $ref: '#/components/schemas/MessageResponse'
                    },
                    {
                      type: 'object',
                      properties: {
                        oc: {
                          $ref: '#/components/schemas/Oc'
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/{id}/aprovar': {
      put: {
        tags: ['OCs'],
        summary: 'Aprova uma OC',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer'
            },
            example: 10
          }
        ],
        responses: {
          200: {
            description: 'OC aprovada',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MessageResponse'
                },
                example: {
                  message: 'OC aprovada com sucesso'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          }
        }
      }
    },
    '/ocs/{id}/recontagem': {
      put: {
        tags: ['OCs'],
        summary: 'Envia itens de uma OC para recontagem',
        security: [
          {
            bearerAuth: []
          }
        ],
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer'
            },
            example: 10
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/RecountRequest'
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Itens enviados para recontagem',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/MessageResponse'
                },
                example: {
                  message: 'Itens enviados para recontagem'
                }
              }
            }
          },
          400: {
            $ref: '#/components/responses/BadRequest'
          },
          401: {
            $ref: '#/components/responses/Unauthorized'
          },
          403: {
            $ref: '#/components/responses/Forbidden'
          },
          404: {
            $ref: '#/components/responses/NotFound'
          }
        }
      }
    }
  }
};

module.exports = openApiDefinition;
