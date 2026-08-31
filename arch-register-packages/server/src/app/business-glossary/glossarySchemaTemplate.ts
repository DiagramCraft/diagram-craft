import { AR_COLOR_BLUE, AR_COLOR_PURPLE } from '@arch-register/api-types/colors';
import {
  commonDocumentTemplates,
  commonDocumentTypes,
  enumDefinition
} from '../../domain/catalog/schemaTemplateBase';
import type { SchemaTemplate, TemplateSchema } from '../../domain/catalog/schemaTemplates';

/**
 * Business Glossary's schema template pack: the Term/Term Category schemas, the glossary-status
 * enum, and the `business-glossary` capability binding, spread into `SCHEMA_TEMPLATES` by
 * `../../domain/catalog/schemaTemplates.ts`.
 */

const glossaryStatusEnum = enumDefinition(
  'glossary-status',
  'Glossary Status',
  [
    { value: 'draft', label: 'Draft' },
    { value: 'proposed', label: 'Proposed' },
    { value: 'approved', label: 'Approved' }
  ],
  'Glossary'
);

const businessGlossarySchemas: TemplateSchema[] = [
  {
    symId: 'term',
    name: 'Term',
    description: 'A governed business term with a definition, aliases, and category membership.',
    category: 'Glossary',
    color: AR_COLOR_BLUE,
    icon: 'book',
    fields: [
      { id: 'definition', name: 'Definition', type: 'longtext' },
      {
        id: 'synonyms',
        name: 'Synonyms',
        type: 'text',
        minCardinality: 0,
        maxCardinality: -1
      },
      {
        id: 'abbreviations',
        name: 'Abbreviations',
        type: 'text',
        minCardinality: 0,
        maxCardinality: -1
      },
      {
        id: 'categories',
        name: 'Categories',
        predicate: 'categorized as',
        type: 'reference',
        symSchemaId: 'term_category',
        minCount: 0,
        maxCount: -1
      },
      { id: 'status', name: 'Status', type: 'select', enumId: 'glossary-status' }
    ]
  },
  {
    symId: 'term_category',
    name: 'Term Category',
    description: 'A flat category used to organize business terms.',
    category: 'Glossary',
    color: AR_COLOR_PURPLE,
    icon: 'tags',
    fields: []
  }
];

export const glossarySchemaTemplate: SchemaTemplate = {
  id: 'glossary',
  category: 'cross-cutting',
  name: 'Business Glossary',
  description: 'Business terms, aliases, categories, and governance-ready definitions.',
  schemas: businessGlossarySchemas,
  enums: [glossaryStatusEnum],
  documentTypes: commonDocumentTypes,
  documentTemplates: commonDocumentTemplates,
  capabilityConfigurations: [
    {
      type: 'business-glossary',
      bindings: {
        term: { target: { kind: 'entity_schema', symId: 'term' } },
        category: { target: { kind: 'entity_schema', symId: 'term_category' } }
      }
    }
  ]
};
