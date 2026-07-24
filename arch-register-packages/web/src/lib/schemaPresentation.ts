import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import type { DocumentType } from '@arch-register/api-types/documentContract';
import type { EntitySchema, SchemaField } from '@arch-register/api-types/schemaContract';

export type FieldType = SchemaField['type'];

export const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'longtext', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select' },
  { value: 'reference', label: 'Reference' },
  { value: 'containment', label: 'Containment' }
];

export const schemaColor = (index: number): string => SCHEMA_COLORS[index % SCHEMA_COLORS.length]!;

export const resolveSchemaColor = (schema: EntitySchema, index: number): string =>
  schema.color ?? schemaColor(index);

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
