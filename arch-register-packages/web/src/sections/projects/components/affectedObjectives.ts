import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceCapabilityConfiguration } from '@arch-register/api-types/workspaceCapabilityContract';

const STRATEGY_CAPABILITY = 'strategy-model';
const OBJECTIVE_RELATION_NAME = 'Objective Affects Entity';
const OBJECTIVE_RELATION_OUT_LABEL = 'Affected by Objective';

export type AffectedObjective = {
  id: string;
  name: string;
};

export type AffectedObjectiveConfig = {
  objectiveSchemaId: string;
  relationSchemaId: string;
};

export type AffectedObjectivesStatus = 'hidden' | 'loading' | 'ready' | 'error';

export type AffectedObjectivesState = {
  status: AffectedObjectivesStatus;
  byMember: ReadonlyMap<string, readonly AffectedObjective[]>;
  objectives: readonly AffectedObjective[];
};

const sortObjectives = (objectives: readonly AffectedObjective[]) =>
  [...objectives].sort((left, right) => {
    const nameOrder = left.name.localeCompare(right.name);
    return nameOrder !== 0 ? nameOrder : left.id.localeCompare(right.id);
  });

/** Resolve the configured strategy objective schema and its seeded impact relation. */
export const resolveAffectedObjectiveConfig = (
  relationSchemas: readonly RelationSchema[],
  capabilityConfigurations: readonly WorkspaceCapabilityConfiguration[] | undefined
): AffectedObjectiveConfig | null => {
  const strategyConfiguration = capabilityConfigurations?.find(
    configuration => configuration.type === STRATEGY_CAPABILITY
  );
  const objectiveBinding = strategyConfiguration?.bindings.objective;
  if (
    !strategyConfiguration?.valid ||
    objectiveBinding?.target.kind !== 'entity_schema' ||
    objectiveBinding.target.id.length === 0
  ) {
    return null;
  }

  const relationSchema = relationSchemas.find(
    relation =>
      relation.name === OBJECTIVE_RELATION_NAME &&
      relation.out.label === OBJECTIVE_RELATION_OUT_LABEL &&
      relation.in.schemaIds !== 'any' &&
      relation.in.schemaIds.includes(objectiveBinding.target.id) &&
      relation.out.schemaIds === 'any'
  );
  return relationSchema
    ? {
        objectiveSchemaId: objectiveBinding.target.id,
        relationSchemaId: relationSchema.id
      }
    : null;
};

export const existingEntityMemberIds = (memberKeys: readonly string[]) =>
  [...new Set(memberKeys.filter(memberKey => !memberKey.startsWith('draft:')))].sort();

export const extractAffectedObjectives = (
  records: readonly RelationRecord[],
  config: AffectedObjectiveConfig | null
): AffectedObjective[] => {
  if (config === null) return [];

  const objectives = new Map<string, AffectedObjective>();
  for (const record of records) {
    if (record._schema.id !== config.relationSchemaId) continue;
    if (record._in.schemaId !== undefined && record._in.schemaId !== config.objectiveSchemaId) {
      continue;
    }
    objectives.set(record._in.id, { id: record._in.id, name: record._in.name });
  }
  return sortObjectives([...objectives.values()]);
};

export const combineAffectedObjectives = (
  byMember: ReadonlyMap<string, readonly AffectedObjective[]>
): AffectedObjective[] => {
  const objectives = new Map<string, AffectedObjective>();
  for (const memberObjectives of byMember.values()) {
    for (const objective of memberObjectives) objectives.set(objective.id, objective);
  }
  return sortObjectives([...objectives.values()]);
};
