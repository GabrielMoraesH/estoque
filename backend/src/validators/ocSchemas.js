const { z, emptyObjectSchema, idParamSchema, itemIdParamSchema } = require('./commonSchemas');

const ocItemInputSchema = z.object({
  produto: z.string().trim().min(1),
  saldo_sistema: z.coerce.number(),
  endereco: z.string().optional(),
  codigo: z.string().optional(),
  codigo_barras: z.string().optional(),
  validade: z.string().optional()
});

const createOcBodySchema = z.object({
  gestor_id: z.coerce.number().int().positive(),
  estoquista_id: z.coerce.number().int().positive()
});

const createOcWithItemsBodySchema = z.object({
  gestor_id: z.coerce.number().int().positive(),
  estoquista_id: z.coerce.number().int().positive(),
  items: z.array(ocItemInputSchema)
});

const recountBodySchema = z.object({
  itemIds: z.array(z.coerce.number().int().positive()).min(1)
});

const addItemBodySchema = z.object({
  produto: z.string().trim().min(1),
  saldo_sistema: z.coerce.number()
});

const updateItemBodySchema = z.object({
  saldo_contado: z.coerce.number(),
  lote: z.string().trim().min(1)
});

const saveCountBodySchema = z.object({
  oc_id: z.coerce.number().int().positive(),
  item_id: z.coerce.number().int().positive().optional(),
  oc_localizacao_id: z.coerce.number().int().positive().optional(),
  quantidade: z.coerce.number().int().min(0),
  lote: z.string().trim().min(1)
}).refine((data) => data.item_id || data.oc_localizacao_id, {
  message: 'Informe item_id ou oc_localizacao_id',
  path: ['oc_localizacao_id']
});

module.exports = {
  createOcSchema: {
    body: createOcBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  createOcWithItemsSchema: {
    body: createOcWithItemsBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  gestorOcListSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  estoquistaOcListSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  approvalAdminListSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  approvalGestorListSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  approveOcSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  recountOcSchema: {
    body: recountBodySchema,
    params: idParamSchema,
    query: emptyObjectSchema
  },
  addItemSchema: {
    body: addItemBodySchema,
    params: idParamSchema,
    query: emptyObjectSchema
  },
  listItemsSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  updateItemSchema: {
    body: updateItemBodySchema,
    params: itemIdParamSchema,
    query: emptyObjectSchema
  },
  saveCountSchema: {
    body: saveCountBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  finalizeOcSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  listCountsSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  }
};
