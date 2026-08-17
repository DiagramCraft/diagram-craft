import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';

export type FieldType = SchemaField['type'];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'currency', label: 'Currency' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'reference', label: 'Reference' },
  { value: 'containment', label: 'Containment' },
  { value: 'typedRelation', label: 'Typed relation' },
  { value: 'derived', label: 'Derived' }
];

export type RelationFieldType = RelationField['type'];

// Relation fields intentionally exclude containment/derived — see relationSchemaContract.ts.
// `entityRelation` is relation-only (mirrors entity schemas' `reference`), so it's appended here
// rather than filtered out of the entity FIELD_TYPES list above.
export const RELATION_FIELD_TYPES: { value: RelationFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'entityRelation', label: 'Entity relation' }
];

export const schemaColor = (index: number): string => SCHEMA_COLORS[index % SCHEMA_COLORS.length]!;

export const resolveSchemaColor = (schema: { color: string | null }, index: number): string =>
  schema.color ?? schemaColor(index);

export const UNCATEGORIZED_SCHEMA_CATEGORY = 'Uncategorized';

export type SchemaCategoryGroup<T> = {
  category: string;
  items: Array<{ schema: T; index: number }>;
};

export const groupSchemasByCategory = <T extends { category?: string | null; name: string }>(
  schemas: readonly T[]
): SchemaCategoryGroup<T>[] => {
  const groups = new Map<string, Array<{ schema: T; index: number }>>();

  schemas.forEach((schema, index) => {
    const trimmedCategory = schema.category?.trim();
    const category =
      trimmedCategory === undefined || trimmedCategory.length === 0
        ? UNCATEGORIZED_SCHEMA_CATEGORY
        : trimmedCategory;
    const items = groups.get(category) ?? [];
    items.push({ schema, index });
    groups.set(category, items);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => {
      if (left === UNCATEGORIZED_SCHEMA_CATEGORY) return 1;
      if (right === UNCATEGORIZED_SCHEMA_CATEGORY) return -1;
      return left.localeCompare(right);
    })
    .map(([category, items]) => ({
      category,
      items: items.sort((left, right) => left.schema.name.localeCompare(right.schema.name))
    }));
};

export const resolveDocumentTypeColor = (documentType: DocumentType, index: number): string =>
  documentType.color ?? schemaColor(index);

export const SCHEMA_ICONS = [
  'box',
  'api',
  'server',
  'database',
  'cloud',
  'lock',
  'users',
  'globe',
  'cpu',
  'network',
  'folder',
  'terminal',
  'plug',
  'layers',
  'git-branch',
  'shield',
  'code',
  'message',
  'settings',
  'chart',
  'bell',
  'key',
  'mail',
  'map-pin',
  'clipboard',
  'tag',
  'link',
  'truck',
  'heart',
  'rocket',
  'building',
  'package',
  'puzzle',
  'wand',
  'eye',
  'flame',
  'snowflake',
  'compass',
  'antenna',
  'certificate',
  'bolt',
  'palette',
  'microscope'
] as const;

export type SchemaIconId = (typeof SCHEMA_ICONS)[number];
