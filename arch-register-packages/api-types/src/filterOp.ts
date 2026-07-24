import { z } from 'zod';

export const filterOpSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'ends_with',
  'empty',
  'not_empty',
  'before',
  'after',
  'on',
  'gt',
  'lt',
  'gte',
  'lte'
]);

export type FilterOp = z.infer<typeof filterOpSchema>;
