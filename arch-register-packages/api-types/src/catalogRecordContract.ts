import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';

/**
 * Shared discriminated union over the two catalog-record kinds, mirroring the `kind` column on
 * the unified `catalog_record` DB table (migration 087). Generalizes the ad hoc
 * `{ kind: 'entity' | 'relation' }` unions that call sites (e.g. changeCaseOperations.ts) already
 * built independently.
 */
export type CatalogRecord =
  | { kind: 'entity'; entity: EntityRecord }
  | { kind: 'relation'; relation: RelationRecord };
