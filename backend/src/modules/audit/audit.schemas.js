const { z, emptyObjectSchema } = require('../shared/commonSchemas');

const optionalText = z.string().trim().max(80).optional();
const listAuditQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: optionalText,
  action: optionalText,
  entity_type: optionalText,
  empresa_id: z.coerce.number().int().positive().optional(),
  date_from: z.iso.date().optional(),
  date_to: z.iso.date().optional()
});

module.exports = { listAuditSchema: { params: emptyObjectSchema, query: listAuditQuerySchema } };
