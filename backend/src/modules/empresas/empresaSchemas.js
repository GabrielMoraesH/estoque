const { z, emptyObjectSchema, idParamSchema } = require('../shared/commonSchemas');

const codigoSchema = z.string().trim().min(1).max(40);
const nomeSchema = z.string().trim().min(1).max(120);

module.exports = {
  listEmpresasSchema: { params: emptyObjectSchema, query: emptyObjectSchema },
  createEmpresaSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema,
    body: z.object({ codigo: codigoSchema, nome: nomeSchema }).strict()
  },
  updateEmpresaSchema: {
    params: idParamSchema,
    query: emptyObjectSchema,
    body: z.object({ nome: nomeSchema }).strict()
  },
  updateEmpresaStatusSchema: {
    params: idParamSchema,
    query: emptyObjectSchema,
    body: z.object({ ativo: z.boolean() }).strict()
  }
};
