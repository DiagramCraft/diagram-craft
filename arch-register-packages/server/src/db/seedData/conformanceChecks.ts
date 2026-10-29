import type { ConformanceCheckDbCreate } from '../../domain/conformance/db/conformanceDatabase';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { SEED_SCHEMA_IDS, WORKSPACE_ID, now } from './constants';

// `value` is always present (null for 'empty'): JSON storage drops `undefined`, and the output
// schema requires the key.
const dataEntityQuery = (fieldId: string, op: 'empty' | 'not_equals', value: unknown = null) =>
  ({
    schemaId: SEED_SCHEMA_IDS.dataEntity,
    root: { kind: 'predicate', path: [], fieldId, op, value }
  }) satisfies EntityQuery;

const dataEntityCheck = (
  n: number,
  name: string,
  description: string,
  severity: 'error' | 'warning',
  query: EntityQuery,
  message: string
): ConformanceCheckDbCreate => ({
  id: `00000000-0000-0000-0060-${String(n).padStart(12, '0')}`,
  workspace: WORKSPACE_ID,
  name,
  description,
  severity,
  enabled: true,
  definition: { type: 'query_policy', query, message },
  revision: 1,
  created_by: null,
  created_at: now,
  updated_at: now
});

/**
 * Data Stewardship coverage checks for the demo workspace: one per gap the Stewardship dashboard
 * surfaces. Datasets matching a query are the violations, so each query describes the gap.
 */
export const seedConformanceChecks: ConformanceCheckDbCreate[] = [
  dataEntityCheck(
    1,
    'Dataset has no business owner',
    'Every dataset needs an accountable business owner.',
    'error',
    dataEntityQuery('_owner', 'empty'),
    'No business owner assigned'
  ),
  dataEntityCheck(
    2,
    'Dataset has no steward',
    'Every dataset needs a steward responsible for its day-to-day quality.',
    'error',
    dataEntityQuery('steward', 'empty'),
    'No steward assigned'
  ),
  dataEntityCheck(
    3,
    'Dataset classification not confirmed',
    'Every dataset needs a confirmed classification.',
    'warning',
    dataEntityQuery('classification', 'empty'),
    'Classification not confirmed'
  ),
  dataEntityCheck(
    4,
    'Dataset review not current',
    'Datasets must have a scheduled review that is not overdue or approaching.',
    'warning',
    dataEntityQuery('review_status', 'not_equals', 'current'),
    'Review is not current'
  )
];
