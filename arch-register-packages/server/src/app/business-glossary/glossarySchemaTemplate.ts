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
      {
        id: 'definition',
        name: 'Definition',
        description: 'The agreed meaning of the term, written for a reader outside the team.',
        type: 'longtext'
      },
      {
        id: 'synonyms',
        name: 'Synonyms',
        description: 'Other words people use for the same concept.',
        type: 'text',
        minCardinality: 0,
        maxCardinality: -1
      },
      {
        id: 'abbreviations',
        name: 'Abbreviations',
        description: 'Short forms or acronyms for the term.',
        type: 'text',
        minCardinality: 0,
        maxCardinality: -1
      },
      {
        id: 'categories',
        name: 'Categories',
        description: 'Glossary categories this term belongs to, used for grouping and browsing.',
        predicate: 'categorized as',
        type: 'reference',
        symSchemaId: 'term_category',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'status',
        name: 'Status',
        description: 'Whether the term is a draft, approved or retired.',
        type: 'select',
        enumId: 'glossary-status'
      }
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
  entityDrawerProfiles: {
    term: {
      header: {
        badges: [
          { kind: 'field', fieldId: 'status', showLabel: false },
          { kind: 'metadata', slot: 'lifecycle' }
        ]
      },
      sections: [
        {
          id: 'attributes',
          title: 'Attributes',
          collapsible: false,
          items: [
            { kind: 'field', fieldId: 'definition' },
            { kind: 'field', fieldId: 'synonyms' },
            { kind: 'field', fieldId: 'abbreviations' }
          ]
        },
        {
          id: 'details',
          title: 'Details',
          collapsible: true,
          items: [
            { kind: 'metadata', slot: 'owner' },
            { kind: 'relation', fieldId: 'categories' },
            { kind: 'slot', slotId: 'entity.usage', label: 'Usage & backlinks' }
          ]
        }
      ]
    }
  }
};
