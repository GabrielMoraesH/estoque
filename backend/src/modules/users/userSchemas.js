const { z, emptyObjectSchema, idParamSchema } = require('../shared/commonSchemas');

const roleSchema = z.enum(['admin', 'gestor', 'estoquista']);
const nivelEstoquistaSchema = z.coerce.number().int().min(1).max(3).nullable().optional();
const empresaIdsSchema = z.array(z.coerce.number().int().positive())
  .min(1, 'Informe ao menos uma empresa de acesso')
  .refine((empresaIds) => new Set(empresaIds).size === empresaIds.length, {
    message: 'Empresas de acesso nao podem ser duplicadas'
  });

function withNivelEstoquistaRules(schema) {
  return schema.superRefine((data, ctx) => {
    if (data.role === 'estoquista') {
      if (![1, 2, 3].includes(data.nivel_estoquista)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['nivel_estoquista'],
          message: 'Informe o nivel do estoquista'
        });
      }
      return;
    }

    if (data.nivel_estoquista !== undefined && data.nivel_estoquista !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nivel_estoquista'],
        message: 'Nivel de estoquista permitido apenas para usuarios estoquistas'
      });
    }
  });
}

const registerUserBodySchema = withNivelEstoquistaRules(z.object({
  nome: z.string().trim().min(1),
  login: z.string().trim().min(1),
  senha: z.string().min(1),
  role: roleSchema,
  nivel_estoquista: nivelEstoquistaSchema,
  empresa_ids: empresaIdsSchema
}));

const loginBodySchema = z.object({
  login: z.string().trim().min(1),
  senha: z.string().min(1)
});

const updateUserBodySchema = withNivelEstoquistaRules(z.object({
  nome: z.string().trim().min(1),
  login: z.string().trim().min(1),
  role: roleSchema,
  nivel_estoquista: nivelEstoquistaSchema,
  senha: z.string().optional().default(''),
  empresa_ids: empresaIdsSchema.optional()
}));

const updateUserStatusBodySchema = z.object({
  ativo: z.boolean()
});

module.exports = {
  registerUserSchema: {
    body: registerUserBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  loginSchema: {
    body: loginBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  listUsersSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  updateUserSchema: {
    body: updateUserBodySchema,
    params: idParamSchema,
    query: emptyObjectSchema
  },
  updateUserStatusSchema: {
    body: updateUserStatusBodySchema,
    params: idParamSchema,
    query: emptyObjectSchema
  },
  deleteUserSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  listEstoquistasSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema
  }
};
