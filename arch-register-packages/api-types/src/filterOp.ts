import { z } from 'zod';

/** Maximum number of values accepted by one `in` predicate. */
export const MAX_FILTER_IN_VALUES = 500;

const FILTER_OPS_WITHOUT_IN = [
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
] as const;

export const nonInFilterOpSchema = z.enum(FILTER_OPS_WITHOUT_IN);

export const filterOpSchema = z.enum([
  ...FILTER_OPS_WITHOUT_IN,
  // Matches when the field's value is one of `value` (a bounded array). Supported by the
  // entity-query text DSL, but deliberately not offered as a choice in any FilterBuilder UI.
  'in'
]);

export type FilterOp = z.infer<typeof filterOpSchema>;
export type NonInFilterOp = z.infer<typeof nonInFilterOpSchema>;

/** The structured value shape for membership predicates. Empty arrays are intentional IR. */
export const filterInValueSchema = z.array(z.unknown()).max(MAX_FILTER_IN_VALUES);
export type FilterInValue = z.infer<typeof filterInValueSchema>;

export const isValidFilterInValue = (value: unknown): value is FilterInValue =>
  Array.isArray(value) && value.length <= MAX_FILTER_IN_VALUES;
