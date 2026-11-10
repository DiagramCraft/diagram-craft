import type { SchemaDraftItem } from './useSchemaDraftState';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { SharedFieldGroup } from '@arch-register/api-types/fieldGroupContract';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import type { Category } from '@arch-register/api-types/categoryContract';

export type DraftBadge = 'new' | 'changed' | 'deleted';

/**
 * Overlays staged draft items on the live list: updates replace the live item, creates are
 * appended, deletes are kept but flagged so editors can show them as removed-in-draft.
 */
export const overlayDraftItems = <T extends { id: string }>(
  live: T[],
  items: SchemaDraftItem[],
  toLive: (payload: unknown, existing: T | undefined, id: string) => T
): Array<{ item: T; badge: DraftBadge | null }> => {
  const byId = new Map(items.map(i => [i.item_id, i]));
  const result: Array<{ item: T; badge: DraftBadge | null }> = live.map(item => {
    const staged = byId.get(item.id);
    if (!staged) return { item, badge: null as DraftBadge | null };
    if (staged.op === 'delete') return { item, badge: 'deleted' as DraftBadge };
    return { item: toLive(staged.payload, item, item.id), badge: 'changed' as DraftBadge };
  });
  const liveIds = new Set(live.map(l => l.id));
  for (const staged of items) {
    if (staged.op === 'create' && !liveIds.has(staged.item_id)) {
      result.push({
        item: toLive(staged.payload, undefined, staged.item_id),
        badge: 'new' as DraftBadge
      });
    }
  }
  return result;
};

type EnumBody = {
  name: string;
  category_id?: string | null;
  options?: Array<{
    value: string;
    label: string;
    description?: string | null;
    retired?: boolean;
    restricted?: boolean;
  }>;
  sort_order?: number;
};

export const enumFromPayload = (
  payload: unknown,
  existing: WorkspaceEnum | undefined,
  id: string,
  workspace: string,
  categories: Category[]
): WorkspaceEnum => {
  const body = payload as EnumBody;
  const category = categories.find(c => c.id === body.category_id);
  const now = new Date().toISOString();
  return {
    id,
    workspace: existing?.workspace ?? workspace,
    name: body.name,
    category: category ? { id: category.id, name: category.name } : null,
    options: (body.options ?? []).map(o => ({
      value: o.value,
      label: o.label,
      description: o.description ?? null,
      retired: o.retired ?? false,
      restricted: o.restricted ?? false
    })),
    sort_order: body.sort_order ?? existing?.sort_order ?? 0,
    created_at: existing?.created_at ?? now,
    updated_at: existing?.updated_at ?? now
  };
};

/**
 * Applies a staged create/update body on top of a live item (or a blank item for creates).
 * Body field names match the live shape except `category_id`, which becomes a resolved `category`.
 */
export const applyPayload = <T extends { id: string }>(
  base: T,
  payload: unknown,
  categories: Category[]
): T => {
  const {
    category_id,
    fieldMigrations: _migrations,
    ...rest
  } = (payload ?? {}) as Record<string, unknown> & {
    category_id?: string | null;
    fieldMigrations?: unknown;
  };
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) next[key] = value;
  }
  if (category_id !== undefined) {
    const category = categories.find(c => c.id === category_id);
    next.category = category ? { id: category.id, name: category.name } : null;
  }
  return next as T;
};

/** Blank live-shaped items used as the base when a staged create has no live counterpart. */
export const blankEntitySchema = (id: string) =>
  ({
    id,
    name: '',
    description: '',
    key_prefix: '',
    fields: [],
    templates: [],
    groups: [],
    entity_count: 0,
    version: 1,
    category: null,
    color: null,
    icon: null
  }) as unknown as EntitySchema;

export const blankRelationSchema = (id: string) =>
  ({
    id,
    name: '',
    description: '',
    fields: [],
    groups: [],
    relation_count: 0,
    version: 1,
    category: null,
    color: null,
    icon: null
  }) as unknown as RelationSchema;

export const blankFieldGroup = (id: string) =>
  ({ id, name: '', description: '', fields: [], category: null }) as unknown as SharedFieldGroup;

export const blankDocumentType = (id: string) =>
  ({
    id,
    workspace: '',
    name: '',
    description: '',
    fields: [],
    aiActions: [],
    color: null,
    icon: null,
    archived: false,
    version: 1,
    created_at: '',
    updated_at: ''
  }) as unknown as DocumentType;
