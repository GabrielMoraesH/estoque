const { z } = require('zod');

const emptyObjectSchema = z.object({}).strict();

const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

module.exports = {
  z,
  emptyObjectSchema,
  idParamSchema
};
