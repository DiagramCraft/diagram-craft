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
  { value: 'principal', label: 'Person or team' },
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

export type NamedCategory = { id: string; name: string };

export const compareSchemaCategories = (left: string, right: string): number => {
  if (left === UNCATEGORIZED_SCHEMA_CATEGORY) return 1;
  if (right === UNCATEGORIZED_SCHEMA_CATEGORY) return -1;
  return left.localeCompare(right);
};

export type SchemaCategoryGroup<T> = {
  /** null for the synthetic Uncategorized bucket — never a real category row. */
  categoryId: string | null;
  /** Display name ("Uncategorized" when the item has no category). */
  category: string;
  items: Array<{ schema: T; index: number }>;
};

// Items with no embedded category fall back to a synthetic "Uncategorized" bucket rather than a
// real category row — see [[project_category_table]].
export const groupSchemasByCategory = <
  T extends { category?: NamedCategory | null; name: string }
>(
  schemas: readonly T[]
): SchemaCategoryGroup<T>[] => {
  const groups = new Map<
    string,
    { categoryId: string | null; name: string; items: Array<{ schema: T; index: number }> }
  >();

  schemas.forEach((schema, index) => {
    const categoryId = schema.category?.id ?? null;
    const name = schema.category?.name ?? UNCATEGORIZED_SCHEMA_CATEGORY;
    const key = categoryId ?? '';
    const group = groups.get(key) ?? { categoryId, name, items: [] };
    group.items.push({ schema, index });
    groups.set(key, group);
  });

  return [...groups.values()]
    .sort((left, right) => compareSchemaCategories(left.name, right.name))
    .map(group => ({
      categoryId: group.categoryId,
      category: group.name,
      items: group.items.sort((left, right) => left.schema.name.localeCompare(right.schema.name))
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
