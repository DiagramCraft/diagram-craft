import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult } from './db/catalogDatabase';
import type { RelationDbResult, RelationSchemaDbResult } from './db/relationDatabase';
import { restrictedFieldIds } from '../auth/fieldGroupAccessControl';

export type CrossBoundaryStatus = 'cross-boundary' | 'same-region' | 'incomplete';
export type ResidencyValidityStatus = 'invalid' | 'valid' | 'incomplete' | 'not-applicable';

const SOURCE_REGION_FIELD_ID = 'source_residency_region';
const DESTINATION_REGION_FIELD_ID = 'destination_residency_region';
const CARRIED_DATA_ENTITIES_FIELD_ID = 'data_entities';
const PERMITTED_RESIDENCY_REGIONS_FIELD_ID = 'permitted_residency_regions';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim() !== '';

/**
 * Compares a Data Flow's source and destination residency regions. Never treats a missing region
 * as compliant — a missing region is reported as `'incomplete'`, distinct from `'same-region'`.
 */
export const computeCrossBoundary = (
  sourceRegion: unknown,
  destinationRegion: unknown
): CrossBoundaryStatus => {
  if (!isNonEmptyString(sourceRegion) || !isNonEmptyString(destinationRegion)) return 'incomplete';
  return sourceRegion === destinationRegion ? 'same-region' : 'cross-boundary';
};

/**
 * Compares a Data Flow's destination residency region against the permitted-residency-regions of
 * each carried Data Entity. `'not-applicable'` when there are no carried entities, or none of them
 * declare any permitted regions (nothing to violate) — as opposed to `'incomplete'`, which means
 * the destination region itself is missing and can't be evaluated. `'invalid'` when the
 * destination region is absent from any carried entity's permitted-regions list.
 */
export const computeResidencyInvalid = (
  destinationRegion: unknown,
  carriedEntitiesPermittedRegions: readonly (readonly string[])[]
): ResidencyValidityStatus => {
  const applicable = carriedEntitiesPermittedRegions.filter(regions => regions.length > 0);
  if (applicable.length === 0) return 'not-applicable';
  if (!isNonEmptyString(destinationRegion)) return 'incomplete';

  const violatesAny = applicable.some(regions => !regions.includes(destinationRegion));
  return violatesAny ? 'invalid' : 'valid';
};

export type DataFlowResidencyStatus = {
  crossBoundary: CrossBoundaryStatus;
  residencyInvalid: ResidencyValidityStatus;
};

// Only the fields actually read below are required.
type DataFlowResidencyInput = Pick<RelationDbResult, 'data'>;

/**
 * Computes both the cross-boundary and residency-invalid status for a Data Flow relation, honoring
 * field-group redaction so a restricted region value can't leak through the computed status. Callers
 * that already know the carried Data Entities' permitted-residency-regions (e.g. #3066's analysis
 * views, which can batch-resolve them) should call this directly; `resolveDataFlowResidencyStatus`
 * below is the convenience wrapper that resolves them from the database for a single relation.
 */
export const computeDataFlowResidencyStatus = (
  relation: DataFlowResidencyInput,
  schema: RelationSchemaDbResult,
  carriedEntitiesPermittedRegions: readonly (readonly string[])[],
  authCtx: AuthorizationContext | null = null
): DataFlowResidencyStatus => {
  const restricted = restrictedFieldIds(authCtx, schema);
  const hasSourceField = schema.fields.some(field => field.id === SOURCE_REGION_FIELD_ID);
  const hasDestinationField = schema.fields.some(field => field.id === DESTINATION_REGION_FIELD_ID);

  const sourceRegion =
    hasSourceField && !restricted.has(SOURCE_REGION_FIELD_ID)
      ? relation.data[SOURCE_REGION_FIELD_ID]
      : undefined;
  const destinationRegion =
    hasDestinationField && !restricted.has(DESTINATION_REGION_FIELD_ID)
      ? relation.data[DESTINATION_REGION_FIELD_ID]
      : undefined;

  return {
    crossBoundary: computeCrossBoundary(sourceRegion, destinationRegion),
    residencyInvalid: computeResidencyInvalid(destinationRegion, carriedEntitiesPermittedRegions)
  };
};

const permittedRegionsOf = (entity: EntityDbResult): readonly string[] => {
  const value = entity.data[PERMITTED_RESIDENCY_REGIONS_FIELD_ID];
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
};

/**
 * Resolves a Data Flow relation's carried Data Entities and computes cross-boundary/residency-invalid
 * status against their permitted-residency-regions. Returns `null` when the schema doesn't declare
 * the carried-entities field at all (status not applicable to this relation schema).
 */
export const resolveDataFlowResidencyStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  relation: DataFlowResidencyInput,
  schema: RelationSchemaDbResult,
  authCtx: AuthorizationContext | null = null
): Promise<DataFlowResidencyStatus | null> => {
  const hasCarriedEntitiesField = schema.fields.some(
    field => field.id === CARRIED_DATA_ENTITIES_FIELD_ID
  );
  if (!hasCarriedEntitiesField) return null;

  const carriedEntityIds = relation.data[CARRIED_DATA_ENTITIES_FIELD_ID];
  const ids = Array.isArray(carriedEntityIds) ? carriedEntityIds.filter(isNonEmptyString) : [];
  const carriedEntities = await Promise.all(ids.map(id => db.catalog.getEntity(workspace, id)));
  const permittedRegions = carriedEntities
    .filter((entity): entity is EntityDbResult => entity != null)
    .map(permittedRegionsOf);

  return computeDataFlowResidencyStatus(relation, schema, permittedRegions, authCtx);
};
