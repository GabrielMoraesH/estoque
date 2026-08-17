const { z, emptyObjectSchema, idParamSchema } = require('../shared/commonSchemas');

const ocItemInputSchema = z.object({
  produto_externo_id: z.string().optional(),
  produto: z.string().trim().min(1),
  saldo_sistema: z.coerce.number(),
  localizacao_externa_id: z.string().optional(),
  endereco: z.string().optional(),
  codigo: z.string().optional(),
  codigo_barras: z.string().optional(),
  validade: z.string().optional()
});

const createOcWithItemsBodySchema = z.object({
  estoquista_id: z.coerce.number().int().positive(),
  items: z.array(ocItemInputSchema).min(1)
});

const recountBodySchema = z.object({
  itemIds: z.array(z.coerce.number().int().positive()).min(1),
  novo_estoquista_id: z.coerce.number().int().positive()
});

const reassignParamsSchema = z.object({
  ocId: z.coerce.number().int().positive(),
  assignmentId: z.coerce.number().int().positive()
});

const reassignBodySchema = z.object({
  estoquista_id: z.coerce.number().int().positive()
}).strict();

const countQuantitySchema = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmedValue = value.trim();
  return /^\d+$/.test(trimmedValue) ? Number(trimmedValue) : value;
}, z.number().int().min(0).refine(Number.isSafeInteger));

const saveCountBodySchema = z.object({
  oc_id: z.coerce.number().int().positive(),
  item_id: z.coerce.number().int().positive().optional(),
  oc_localizacao_id: z.coerce.number().int().positive().optional(),
  quantidade: countQuantitySchema,
  lote: z.string().trim().min(1)
}).refine((data) => data.item_id || data.oc_localizacao_id, {
  message: 'Informe item_id ou oc_localizacao_id',
  path: ['oc_localizacao_id']
});

const exportOcQuerySchema = z.object({
  status: z.enum(['em_contagem', 'aguardando_aprovacao', 'em_recontagem', 'finalizada']).optional(),
  date_from: z.iso.date().optional(),
  date_to: z.iso.date().optional(),
  creator_id: z.coerce.number().int().positive().optional(),
  responsible_id: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(80).optional()
}).refine((data) => !data.date_from || !data.date_to || data.date_from <= data.date_to, {
  message: 'Data inicial deve ser anterior ou igual a data final', path: ['date_to']
});

module.exports = {
  exportOcSchema: { params: emptyObjectSchema, query: exportOcQuerySchema },
  createOcWithItemsSchema: {
    body: createOcWithItemsBodySchema,
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  myGestorOcListSchema: {
    params: emptyObjectSchema,
    query: emptyObjectSchema
  },
  gestorOcListSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  myEstoquistaOcListSchema: {
    params: emptyObjectSchema,
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
  myApprovalListSchema: {
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
  reassignAssignmentSchema: {
    body: reassignBodySchema,
    params: reassignParamsSchema,
    query: emptyObjectSchema
  },
  listItemsSchema: {
    params: idParamSchema,
    query: emptyObjectSchema
  },
  historyDetailsSchema: {
    params: idParamSchema,
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
  }
};
