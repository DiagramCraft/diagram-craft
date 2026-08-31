import type { CapabilityFieldRole, WorkspaceCapabilityDefinition } from '../../integrationCatalog';

/**
 * Business Glossary's workspace capability definition, spread into `workspaceCapabilityDefinitions`
 * by `../../integrationCatalog.ts`.
 */

const businessGlossaryFieldRoles: CapabilityFieldRole[] = [
  {
    id: 'definition',
    label: 'Definition',
    description: 'The authoritative meaning of the business term.',
    required: true,
    defaultFieldId: 'definition',
    allowedTypes: ['longtext'],
    cardinality: 'single'
  },
  {
    id: 'synonyms',
    label: 'Synonyms',
    description: 'Alternative names for the term.',
    required: true,
    defaultFieldId: 'synonyms',
    allowedTypes: ['text'],
    cardinality: 'multi'
  },
  {
    id: 'abbreviations',
    label: 'Abbreviations',
    description: 'Short forms and abbreviations for the term.',
    required: true,
    defaultFieldId: 'abbreviations',
    allowedTypes: ['text'],
    cardinality: 'multi'
  },
  {
    id: 'categories',
    label: 'Categories',
    description: 'Zero or more flat glossary categories.',
    required: true,
    defaultFieldId: 'categories',
    allowedTypes: ['reference'],
    cardinality: 'multi',
    referenceTargetBinding: 'category'
  },
  {
    id: 'status',
    label: 'Status',
    description: 'Definition maturity, such as Draft, Proposed, or Approved.',
    required: true,
    defaultFieldId: 'status',
    allowedTypes: ['select'],
    cardinality: 'single'
  }
];

export const businessGlossaryCapabilityDefinition: WorkspaceCapabilityDefinition = {
  type: 'business-glossary',
  label: 'Business glossary',
  description: 'Managed business terms, aliases, categories, usage, and quality reports.',
  features: ['alias-search', 'usage', 'quality-reports', 'governance'],
  bindingRoles: [
    {
      id: 'term',
      label: 'Term entity schema',
      description: 'The entity schema used for canonical business terms.',
      required: true,
      targetKind: 'entity_schema',
      fieldRoles: businessGlossaryFieldRoles
    },
    {
      id: 'category',
      label: 'Term category entity schema',
      description: 'The entity schema used for flat glossary categories.',
      required: true,
      targetKind: 'entity_schema',
      fieldRoles: []
    }
  ]
};
