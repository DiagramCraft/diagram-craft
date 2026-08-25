import {
  getWorkspaceCapabilityDefinition,
  resolveCapabilityFieldMappings
} from '@arch-register/api-types/integrationCatalog';
import type { DatabaseAdapter } from '../../db/database';
import { getWorkspaceCapabilityConfiguration } from '../workspace/workspaceCapabilityOperations';
import {
  addRetentionDuration,
  parseIsoDate,
  toIsoDate,
  type RetentionTimeUnit
} from '../../utils/retentionDate';

export const RETENTION_CAPABILITY_TYPE = 'retention';

export type RetentionStatus = 'active' | 'approaching' | 'expired' | 'incomplete';

export type RetentionEvaluation = {
  expiryDate: string | null;
  status: RetentionStatus;
};

const RETENTION_APPROACHING_WINDOW_DAYS = 30;

const isRetentionTimeUnit = (value: unknown): value is RetentionTimeUnit =>
  value === 'days' || value === 'months' || value === 'years';

export const computeRetentionExpiry = (
  duration: number | null | undefined,
  timeUnit: unknown,
  activatedFrom: string | null | undefined,
  now: Date
): RetentionEvaluation => {
  const start = parseIsoDate(activatedFrom);
  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration <= 0 ||
    !isRetentionTimeUnit(timeUnit) ||
    !start
  ) {
    return { expiryDate: null, status: 'incomplete' };
  }

  const expiry = addRetentionDuration(start, duration, timeUnit);
  const expiryDate = toIsoDate(expiry);
  const daysUntilExpiry = Math.floor((expiry.getTime() - now.getTime()) / 86_400_000);
  const status: RetentionStatus =
    daysUntilExpiry < 0
      ? 'expired'
      : daysUntilExpiry <= RETENTION_APPROACHING_WINDOW_DAYS
        ? 'approaching'
        : 'active';

  return { expiryDate, status };
};

/**
 * Resolves the 'retention' workspace capability's two binding roles ('policy' entity schema,
 * 'assignment' relation schema) plus their mapped field ids. Returns null when the capability
 * isn't configured (or isn't validly configured) for the workspace, meaning retention status is
 * not applicable rather than incomplete.
 */
const resolveRetentionBindings = async (db: DatabaseAdapter, workspace: string) => {
  const definition = getWorkspaceCapabilityDefinition(RETENTION_CAPABILITY_TYPE);
  if (!definition) return null;

  const configuration = await getWorkspaceCapabilityConfiguration(
    db,
    workspace,
    RETENTION_CAPABILITY_TYPE
  );
  if (!configuration || !configuration.valid) return null;

  const policyRole = definition.bindingRoles.find(role => role.id === 'policy');
  const assignmentRole = definition.bindingRoles.find(role => role.id === 'assignment');
  const policyBinding = configuration.bindings['policy'];
  const assignmentBinding = configuration.bindings['assignment'];
  if (!policyRole || !assignmentRole || !policyBinding || !assignmentBinding) return null;

  const [policySchema, assignmentSchema] = await Promise.all([
    db.catalog.getSchema(workspace, policyBinding.target.id),
    db.relation.getRelationSchema(workspace, assignmentBinding.target.id)
  ]);
  if (!policySchema || !assignmentSchema) return null;

  const policyMappings = resolveCapabilityFieldMappings(
    policyBinding,
    policyRole.fieldRoles,
    policySchema.fields
  ).mappings;
  const assignmentMappings = resolveCapabilityFieldMappings(
    assignmentBinding,
    assignmentRole.fieldRoles,
    assignmentSchema.fields
  ).mappings;

  const durationFieldId = policyMappings['duration'];
  const timeUnitFieldId = policyMappings['timeUnit'];
  const activatedFromFieldId = assignmentMappings['activatedFrom'];
  if (!durationFieldId || !timeUnitFieldId || !activatedFromFieldId) return null;

  return {
    policySchemaId: policySchema.id,
    assignmentSchemaId: assignmentSchema.id,
    durationFieldId,
    timeUnitFieldId,
    activatedFromFieldId
  };
};

/**
 * Computes the retention expiry/status for a single entity by finding its (at most one, by
 * convention) outgoing 'Subject to Retention Policy'-style relation instance and resolving the
 * duration/time-unit off the target policy entity. Returns null when the 'retention' capability
 * isn't configured for the workspace (status not applicable), as opposed to 'incomplete' (no
 * policy assigned, or assigned but missing data).
 */
export const resolveEntityRetentionStatus = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  now: Date = new Date()
): Promise<RetentionEvaluation | null> => {
  const bindings = await resolveRetentionBindings(db, workspace);
  if (!bindings) return null;

  const { items } = await db.relation.listRelations(
    workspace,
    { schemaId: bindings.assignmentSchemaId, inEntityId: entityId },
    { limit: 1 }
  );
  const assignment = items[0];
  if (!assignment) return { expiryDate: null, status: 'incomplete' };

  const policyEntity = await db.catalog.getEntity(workspace, assignment.out_entity_id);
  const duration = policyEntity?.data[bindings.durationFieldId];
  const timeUnit = policyEntity?.data[bindings.timeUnitFieldId];
  const activatedFrom = assignment.data[bindings.activatedFromFieldId];

  return computeRetentionExpiry(
    typeof duration === 'number' ? duration : null,
    timeUnit,
    typeof activatedFrom === 'string' ? activatedFrom : null,
    now
  );
};
