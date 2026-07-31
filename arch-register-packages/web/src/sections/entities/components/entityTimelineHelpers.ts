import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { ChangeCaseMemberEntry } from './snapshotDisplay';

export type ChangeRow = { label: string; from: string; to: string };

export type SnapshotState = Record<string, unknown>;

const BUILT_IN: { key: string; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'target_lifecycle', label: 'Target lifecycle' },
  { key: 'target_lifecycle_date', label: 'Target date' },
  { key: 'owner', label: 'Owner' }
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

  // Compare the resolved display strings, not the raw values — otherwise equivalent "empty"
  // representations (null vs '' vs undefined vs []) show up as a change even though both sides
  // render identically (e.g. as "—").
  for (const { key, label } of BUILT_IN) {
    const from = resolveBuiltIn(key, base?.[key], lifecycleStates, teams);
    const to = resolveBuiltIn(key, proposed[key], lifecycleStates, teams);
    if (from === to) continue;
    changes.push({ label, from, to });
  }

  const baseData = (base?.data ?? {}) as Record<string, unknown>;
  const proposedData = (proposed.data ?? {}) as Record<string, unknown>;
  for (const [fieldId, toVal] of Object.entries(proposedData)) {
    const fromVal = baseData[fieldId];
    const field = schema?.fields.find(f => f.id === fieldId);
    const from = resolveFieldVal(field, fromVal);
    const to = resolveFieldVal(field, toVal);
    if (from === to) continue;
    changes.push({ label: field?.name ?? fieldId, from, to });
  }

  return changes;
}

const LANDSCAPE_DIFF_FIELD_LABELS: Record<string, string> = {
  slug: 'Slug',
  namespace: 'Namespace',
  name: 'Name',
  description: 'Description',
  owner: 'Owner',
  lifecycle: 'Lifecycle',
  target_lifecycle: 'Target lifecycle',
  target_lifecycle_date: 'Target date',
  tags: 'Tags',
  links: 'Links',
  schema_id: 'Schema',
  project_id: 'Project'
};

function resolveLandscapeDiffValue(
  key: string,
  value: unknown,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): string {
  if (key === 'lifecycle' || key === 'target_lifecycle' || key === 'owner') {
    return resolveBuiltIn(key, value, lifecycleStates, teams);
  }
  if (value == null || value === '') return '—';
  if (key === 'tags') return Array.isArray(value) && value.length > 0 ? value.join(', ') : '—';
  if (key === 'links') {
    return Array.isArray(value) && value.length > 0
      ? value
          .map(
            link =>
              (link as { title?: string; url?: string }).title ?? (link as { url?: string }).url
          )
          .join(', ')
      : '—';
  }
  return String(value);
}

// Backend `entities.diff` (entity-landscape diff) returns raw before/after values keyed by db
// field name (see mutableStateKeys in entityDiff.ts server-side) rather than the display-oriented
// ChangeRow shape `diffSnapshotState` produces from full base/proposed states. This adapts that
// raw diff to ChangeRow[], reusing the same label-resolution helpers so values render consistently
// with the rest of the app (owner/lifecycle names, not raw IDs).
export function mapEntityLandscapeDiffToChangeRows(
  diff: Record<string, { before: unknown; after: unknown }>,
  schema: EntitySchema | null,
  lifecycleStates: WorkspaceLifecycleState[],
  teams: WorkspaceTeam[]
): ChangeRow[] {
  const rows: ChangeRow[] = [];

  for (const [key, { before, after }] of Object.entries(diff)) {
    if (key === 'data') {
      const beforeData = (before ?? {}) as Record<string, unknown>;
      const afterData = (after ?? {}) as Record<string, unknown>;
      const fieldIds = new Set([...Object.keys(beforeData), ...Object.keys(afterData)]);
      for (const fieldId of fieldIds) {
        const field = schema?.fields.find(f => f.id === fieldId);
        const from = resolveFieldVal(field, beforeData[fieldId]);
        const to = resolveFieldVal(field, afterData[fieldId]);
        if (from === to) continue;
        rows.push({ label: field?.name ?? fieldId, from, to });
      }
      continue;
    }

    const label = LANDSCAPE_DIFF_FIELD_LABELS[key] ?? key;
    const from = resolveLandscapeDiffValue(key, before, lifecycleStates, teams);
    const to = resolveLandscapeDiffValue(key, after, lifecycleStates, teams);
    if (from === to) continue;
    rows.push({ label, from, to });
  }

  return rows;
}

export function detectConflicts(entries: ChangeCaseMemberEntry[]): {
  conflictedProjectIds: Set<string>;
  conflictedSnapIds: Set<string>;
} {
  const futures = entries.filter(entry => entry.changeCase.status === 'planned');
  const conflictedProjectIds = new Set<string>();
  const conflictedSnapIds = new Set<string>();
  for (let i = 0; i < futures.length; i++) {
    for (let j = i + 1; j < futures.length; j++) {
      const a = futures[i]!;
      const b = futures[j]!;
      const aKeys = Object.keys(a.member.proposed_state ?? {});
      const bKeys = new Set(Object.keys(b.member.proposed_state ?? {}));
      if (aKeys.some(f => bKeys.has(f))) {
        if (a.changeCase.project_id) conflictedProjectIds.add(a.changeCase.project_id);
        if (b.changeCase.project_id) conflictedProjectIds.add(b.changeCase.project_id);
        conflictedSnapIds.add(a.member.id);
        conflictedSnapIds.add(b.member.id);
      }
    }
  }
  return { conflictedProjectIds, conflictedSnapIds };
}
