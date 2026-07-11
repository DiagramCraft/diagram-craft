import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';

export type ChangeRow = { label: string; from: string; to: string };

export type SnapshotState = Record<string, unknown>;

const BUILT_IN: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'target_lifecycle', label: 'Target lifecycle' },
  { key: 'target_lifecycle_date', label: 'Target date' },
  { key: 'owner', label: 'Owner' },
];

export function resolveBuiltIn(
  key: string,
  value: unknown,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): string {
  if (value == null || value === '') return '—';
  if (key === 'lifecycle' || key === 'target_lifecycle') {
    return lifecycleStates.find(s => s.id === value)?.label ?? String(value);
  }
  if (key === 'owner') {
    return teams.find(t => t.id === value)?.name ?? String(value);
  }
  return String(value);
}

type AnyField = EntitySchema['fields'][number];

export function resolveFieldVal(field: AnyField | undefined, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field?.type === 'select') {
    const opt = (field as Extract<AnyField, { type: 'select' }>).options.find(
      o => o.value === String(value)
    );
    return opt?.label ?? String(value);
  }
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export function diffSnapshotState(
  base: SnapshotState | null | undefined,
  proposed: SnapshotState | null | undefined,
  schema: EntitySchema | null,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): ChangeRow[] {
  if (!proposed) return [];
  const changes: ChangeRow[] = [];

  for (const { key, label } of BUILT_IN) {
    const from = base?.[key];
    const to = proposed[key];
    if (JSON.stringify(from) === JSON.stringify(to)) continue;
    changes.push({
      label,
      from: resolveBuiltIn(key, from, lifecycleStates, teams),
      to: resolveBuiltIn(key, to, lifecycleStates, teams)
    });
  }

  const baseData = (base?.data ?? {}) as Record<string, unknown>;
  const proposedData = (proposed.data ?? {}) as Record<string, unknown>;
  for (const [fieldId, toVal] of Object.entries(proposedData)) {
    const fromVal = baseData[fieldId];
    if (JSON.stringify(fromVal) === JSON.stringify(toVal)) continue;
    const field = schema?.fields.find(f => f.id === fieldId);
    changes.push({
      label: field?.name ?? fieldId,
      from: resolveFieldVal(field, fromVal),
      to: resolveFieldVal(field, toVal)
    });
  }

  return changes;
}

export function detectConflicts(snapshots: EntitySnapshot[]): {
  conflictedProjectIds: Set<string>;
  conflictedSnapIds: Set<string>;
} {
  const futures = snapshots.filter(s => s.status === 'future_update');
  const conflictedProjectIds = new Set<string>();
  const conflictedSnapIds = new Set<string>();
  for (let i = 0; i < futures.length; i++) {
    for (let j = i + 1; j < futures.length; j++) {
      const a = futures[i]!;
      const b = futures[j]!;
      const aKeys = Object.keys(a.proposed_state ?? {});
      const bKeys = new Set(Object.keys(b.proposed_state ?? {}));
      if (aKeys.some(f => bKeys.has(f))) {
        if (a.project_id) conflictedProjectIds.add(a.project_id);
        if (b.project_id) conflictedProjectIds.add(b.project_id);
        conflictedSnapIds.add(a.id);
        conflictedSnapIds.add(b.id);
      }
    }
  }
  return { conflictedProjectIds, conflictedSnapIds };
}
