import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

export type SnapshotState = Record<string, unknown>;
export type ConflictChoice = 'proposed' | 'current';
export type SnapshotConflict = {
  key: string;
  label: string;
  proposedVal: unknown;
  currentVal: unknown;
};

const differs = (left: unknown, right: unknown) => JSON.stringify(left) !== JSON.stringify(right);

export const findSnapshotConflicts = (
  entity: EntityRecord | undefined,
  schema: EntitySchema | null,
  proposed: SnapshotState | null,
  base: SnapshotState
): SnapshotConflict[] => {
  if (!entity || !proposed) return [];
  const conflicts: SnapshotConflict[] = [];
  const metaFields: Array<[string, string, unknown, unknown]> = [
    ['name', 'Name', proposed.name, entity._name],
    ['description', 'Description', proposed.description, entity._description],
    ['owner', 'Owner', proposed.owner, entity._owner?.id ?? null],
    ['lifecycle', 'Lifecycle', proposed.lifecycle, entity._lifecycle?.id ?? null],
    [
      'target_lifecycle',
      'Target Lifecycle',
      proposed.target_lifecycle,
      entity._targetLifecycle?.id ?? null
    ],
    [
      'target_lifecycle_date',
      'Target Date',
      proposed.target_lifecycle_date,
      entity._targetLifecycleDate ?? null
    ],
    ['tags', 'Tags', proposed.tags, entity._tags]
  ];
  for (const [key, label, proposedVal, currentVal] of metaFields) {
    if (differs(proposedVal, base[key]) && differs(currentVal, base[key])) {
      conflicts.push({ key, label, proposedVal, currentVal });
    }
  }
  if (!schema) return conflicts;
  const proposedData = (proposed.data as SnapshotState | undefined) ?? {};
  const baseData = (base.data as SnapshotState | undefined) ?? {};
  for (const field of schema.fields) {
    const proposedVal = proposedData[field.id];
    const baseVal = baseData[field.id];
    const currentVal = entity[field.id];
    if (differs(proposedVal, baseVal) && differs(currentVal, baseVal)) {
      conflicts.push({ key: `data.${field.id}`, label: field.name, proposedVal, currentVal });
    }
  }
  return conflicts;
};

export const resolveSnapshotEntityData = ({
  entity,
  schema,
  proposed,
  base,
  conflictChoices
}: {
  entity: EntityRecord;
  schema: EntitySchema | null;
  proposed: SnapshotState;
  base: SnapshotState;
  conflictChoices: Record<string, ConflictChoice>;
}): Record<string, unknown> => {
  const choose = (key: string, current: unknown, planned: unknown) => {
    if (conflictChoices[key] === 'current') return current;
    return differs(planned, base[key]) ? planned : current;
  };
  const resolved: Record<string, unknown> = {
    _schemaId: proposed.schema_id ?? entity._schema.id,
    _name: choose('name', entity._name, proposed.name),
    _slug: entity._slug,
    _namespace: entity._namespace,
    _description: choose('description', entity._description, proposed.description),
    _owner: choose('owner', entity._owner?.id ?? null, proposed.owner),
    _lifecycle: choose('lifecycle', entity._lifecycle?.id ?? null, proposed.lifecycle),
    _targetLifecycle: choose(
      'target_lifecycle',
      entity._targetLifecycle?.id ?? null,
      proposed.target_lifecycle
    ),
    _targetLifecycleDate: choose(
      'target_lifecycle_date',
      entity._targetLifecycleDate ?? null,
      proposed.target_lifecycle_date
    ),
    _tags: choose('tags', entity._tags, proposed.tags),
    _links: entity._links,
    _projectId: choose('project_id', entity._projectId ?? null, proposed.project_id)
  };
  if (!schema) return resolved;
  const proposedData = (proposed.data as SnapshotState | undefined) ?? {};
  const baseData = (base.data as SnapshotState | undefined) ?? {};
  for (const field of schema.fields) {
    const proposedVal = proposedData[field.id];
    const baseVal = baseData[field.id];
    const currentVal = entity[field.id];
    const hasPlannedChange = differs(proposedVal, baseVal);
    const hasDrift = differs(currentVal, baseVal);
    resolved[field.id] =
      hasPlannedChange && hasDrift && conflictChoices[`data.${field.id}`] === 'current'
        ? currentVal
        : hasPlannedChange
          ? proposedVal
          : currentVal;
  }
  return resolved;
};
