const { z, emptyObjectSchema, idParamSchema } = require('./commonSchemas');

const roleSchema = z.enum(['admin', 'gestor', 'estoquista']);

const registerUserBodySchema = z.object({
  nome: z.string().trim().min(1),
  login: z.string().trim().min(1),
  senha: z.string().min(1),
  role: roleSchema
});

const loginBodySchema = z.object({
  login: z.string().trim().min(1),
  senha: z.string().min(1)
});

const updateUserBodySchema = z.object({
  nome: z.string().trim().min(1),
  login: z.string().trim().min(1),
  role: roleSchema,
  senha: z.string().optional().default('')
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
  deleteUserSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  listEstoquistasSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema
  }
};
