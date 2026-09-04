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
  'lte',
  // Matches when the field's value is one of `value` (expected to be an array). Supported by the
  // entity-query text DSL, but deliberately not offered as a choice in any FilterBuilder UI.
  'in'
]);

export type FilterOp = z.infer<typeof filterOpSchema>;
