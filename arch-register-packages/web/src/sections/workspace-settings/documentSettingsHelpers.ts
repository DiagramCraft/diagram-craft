import type {
  DocumentAiAction,
  DocumentFieldType,
  DocumentRequirement
} from '@arch-register/api-types/documentContract';

export const FIELD_TYPE_OPTIONS: { value: DocumentFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'long_text', label: 'Long text' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'date', label: 'Date' },
  { value: 'number', label: 'Number' },
  { value: 'enum', label: 'Enum' },
  { value: 'entity_link', label: 'Entity link' },
  { value: 'document_link', label: 'Document link' }
];

export const REQUIREMENT_OPTIONS: { value: DocumentRequirement; label: string }[] = [
  { value: 'required', label: 'Required' },
  { value: 'expected', label: 'Expected' },
  { value: 'optional', label: 'Optional' }
];

export const AI_ACTION_KIND_OPTIONS: { value: DocumentAiAction['kind']; label: string }[] = [
  { value: 'interactive', label: 'Interactive' },
  { value: 'metadata_generator', label: 'Metadata generator' }
];

export const isLinkType = (type: DocumentFieldType) =>
  type === 'entity_link' || type === 'document_link';
