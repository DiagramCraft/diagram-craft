import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import {
  ASSESSMENT_FIELD_PREFIX,
  resolveAssessmentValue
} from '@arch-register/api-types/assessmentFilter';
import type { BrowserEntityRecord } from './entityBrowserState';
import { formatDate } from '../../../utils/dateFormat';

export const DISPLAY_FIELD_VIEWS = new Set<BrowserView>(['table', 'cards', 'tree', 'explore', 'map']);

export type EntityDisplayField = {
  id: string;
  label: string;
  group: string;
  schemaField?: EntitySchema['fields'][number];
  assessmentField?: {
    type: 'rating' | 'enum' | 'text';
    options?: { value: string; label: string }[];
  };
};

const STANDARD_FIELDS: EntityDisplayField[] = [
  { id: '_description', label: 'Description', group: 'General' },
  { id: '_owner', label: 'Owner', group: 'General' },
  { id: '_lifecycle', label: 'Status', group: 'General' },
  { id: '_slug', label: 'Slug', group: 'General' },
  { id: '_namespace', label: 'Namespace', group: 'General' },
  { id: '_tags', label: 'Tags', group: 'General' },
  { id: '_completeness', label: 'Completeness', group: 'General' },
  { id: '_projectRole', label: 'Project role', group: 'Project' },
  { id: '_projectStatus', label: 'Project status', group: 'Project' }
];

export const DEFAULT_DISPLAY_FIELDS: Record<'table' | 'cards' | 'tree' | 'explore' | 'map', string[]> =
  {
    table: ['_description', '_owner', '_lifecycle', '_projectRole', '_namespace', '_completeness'],
    cards: ['_lifecycle', '_description', '_owner', '_projectRole', '_projectStatus'],
    tree: ['_description', '_owner', '_lifecycle', '_namespace'],
    explore: ['_slug', '_owner'],
    map: ['_description', '_lifecycle', '_owner', '_tags']
  };

const SCALAR_TYPES = new Set(['text', 'longtext', 'boolean', 'date', 'number', 'select']);

export const buildEntityDisplayFields = (
  schemas: EntitySchema[],
  projectContext: boolean,
  joined?: { assessment: Assessment; enums: WorkspaceEnum[] } | null
): EntityDisplayField[] => {
  const fields = STANDARD_FIELDS.filter(field => projectContext || field.group !== 'Project');
  const seen = new Set(fields.map(field => field.id));
  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (!SCALAR_TYPES.has(field.type) || seen.has(field.id)) continue;
      seen.add(field.id);
      fields.push({ id: field.id, label: field.name, group: schema.name, schemaField: field });
    }
  }
  if (joined) {
    const group = `Assessment: ${joined.assessment.name}`;
    for (const field of joined.assessment.fields) {
      const id = `${ASSESSMENT_FIELD_PREFIX}${field.id}`;
      if (seen.has(id)) continue;
      seen.add(id);
      const options =
        field.type === 'enum' ? joined.enums.find(e => e.id === field.enumId)?.options : undefined;
      fields.push({
        id,
        label: field.label,
        group,
        assessmentField: { type: field.type, options }
      });
    }
  }
  return fields;
};

export const getDisplayFieldIds = (
  view: 'table' | 'cards' | 'tree' | 'explore' | 'map',
  config: unknown
): string[] => {
  if (
    config &&
    typeof config === 'object' &&
    Array.isArray((config as { fieldIds?: unknown }).fieldIds)
  ) {
    return [
      ...new Set(
        (config as { fieldIds: unknown[] }).fieldIds.filter(
          (id): id is string => typeof id === 'string'
        )
      )
    ];
  }
  return DEFAULT_DISPLAY_FIELDS[view];
};

export const withDisplayFieldIds = (config: unknown, fieldIds: string[]) => ({
  ...(config && typeof config === 'object' ? config : {}),
  fieldIds
});

export const withoutDisplayFieldIds = (config: unknown): unknown => {
  if (config == null || typeof config !== 'object') return null;
  const { fieldIds: _fieldIds, ...rest } = config as { fieldIds?: unknown } & Record<
    string,
    unknown
  >;
  return Object.keys(rest).length === 0 ? null : rest;
};

export const findEntityDisplayField = (
  id: string,
  entity: Pick<EntityRecord, '_schema'>,
  schemaMap: Map<string, { schema: EntitySchema; index: number }>,
  availableFields: EntityDisplayField[]
) => {
  if (id.startsWith('_')) return availableFields.find(field => field.id === id);
  const definition = schemaMap.get(entity._schema.id)?.schema.fields.find(field => field.id === id);
  if (!definition || !SCALAR_TYPES.has(definition.type)) return undefined;
  return { id, label: definition.name, group: entity._schema.name, schemaField: definition };
};

export const formatEntityDisplayValue = (
  entity: EntityRecord,
  field: EntityDisplayField
): string | null => {
  if (field.assessmentField) {
    const value = resolveAssessmentValue(entity as BrowserEntityRecord, field.id);
    if (value == null) return null;
    if (field.assessmentField.type === 'enum') {
      return (
        field.assessmentField.options?.find(o => o.value === String(value))?.label ?? String(value)
      );
    }
    return String(value);
  }
  if (field.id === '_description') return entity._description || null;
  if (field.id === '_owner') return entity._owner?.name ?? null;
  if (field.id === '_lifecycle') return entity._lifecycle?.name ?? null;
  if (field.id === '_slug') return entity._slug || null;
  if (field.id === '_namespace') return entity._namespace || null;
  if (field.id === '_tags') return entity._tags.length ? entity._tags.join(', ') : null;
  if (field.id === '_completeness')
    return entity._completeness == null ? null : `${entity._completeness}%`;
  if (field.id === '_projectRole') return entity._projectLink?.entityType?.name ?? null;
  if (field.id === '_projectStatus')
    return entity._projectLink?.linked ? (entity._projectLink.isDone ? 'Done' : 'Open') : null;
  const value = entity[field.id];
  if (value == null || value === '') return null;
  if (field.schemaField?.type === 'boolean') return value ? 'Yes' : 'No';
  if (field.schemaField?.type === 'select') {
    return (
      field.schemaField.options.find(option => option.value === String(value))?.label ??
      String(value)
    );
  }
  if (field.schemaField?.type === 'date') return formatDate(value, String(value));
  return String(value);
};
