import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED
} from '@arch-register/api-types/colors';
import { createHash, randomUUID } from 'node:crypto';
import type {
  SchemaDbCreate,
  SharedFieldGroupDbCreate,
  WorkspaceEnumDbCreate
} from '../../db/database';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type {
  WorkspaceCapabilityBindings,
  WorkspaceCapabilityTargetKind
} from '@arch-register/api-types/workspaceCapabilityContract';
import type {
  DocumentTemplateDbCreate,
  DocumentTypeDbCreate
} from '../document/db/documentDatabase';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaDbCreate } from './db/relationDatabase';
import type { SavedViewDbCreate } from './db/catalogDatabase';
import { normalizePublicIdPrefix } from '../../utils/publicIds';

export type SymbolicField =
  | {
      id: string;
      name: string;
      type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency';
      minCardinality?: number;
      maxCardinality?: number;
    }
  | {
      id: string;
      name: string;
      type: 'select';
      enumId: string;
      minCardinality?: number;
      maxCardinality?: number;
    }
  | {
      id: string;
      name: string;
      type: 'number';
      min?: number;
      max?: number;
      minCardinality?: number;
      maxCardinality?: number;
    }
  | {
      id: string;
      name: string;
      type: 'derived';
      expression: string;
      resultType: 'text' | 'number' | 'currency' | 'select' | 'boolean' | 'rating';
      enumId?: string;
    }
  | {
      id: string;
      name: string;
      predicate?: string;
      type: 'reference';
      symSchemaId: string;
      minCount: number;
      maxCount: number;
    }
  | {
      id: string;
      name: string;
      predicate?: string;
      type: 'containment';
      symSchemaId: string;
      minCount: 0 | 1;
      maxCount: 1;
    }
  | {
      id: string;
      name: string;
      type: 'typedRelation';
      symRelationSchemaId: string;
      direction: 'in' | 'out';
      minCount: number;
      maxCount: number;
    };

export type TemplateSchema = {
  symId: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  fields: SymbolicField[];
  sharedFieldGroupIds?: string[];
};

export type SymbolicEnum = {
  id: string;
  name: string;
  options: Array<{ value: string; label: string }>;
};

export type SymbolicDocumentType = {
  id: string;
  name: string;
  description: string;
  fields: DocumentField[];
  color: string | null;
  icon: string | null;
};

export type SymbolicDocumentTemplate = {
  id: string;
  name: string;
  body: string;
  documentTypeId: string;
  metadataDefaults: DocumentMetadata;
};

export type SymbolicDashboardWidget = Omit<DashboardWidget, 'config'> & {
  config: Record<string, unknown>;
};

// A saved view seeded from a template. `filters`/`config` reuse the real EntityQuery/view-config
// shapes, but wherever they carry a schema/relation-schema id (root schemaId, PathStep
// ownerSchemaId/relationSchemaId/ownerSchemaIds, per-mode config schema-id keys), the value is a
// symbolic id (symId-space) resolved against a workspace's idMap at instantiation time. Field ids
// are never symbolic — they pass through unchanged, same as dashboard widget config field ids.
export type SymbolicSavedView = {
  id: string;
  name: string;
  description?: string | null;
  isAdminView?: boolean;
  viewMode: BrowserView;
  filters: EntityQuery;
  config: Record<string, unknown> | null;
};

export type SymbolicRelationSchema = {
  symId: string;
  name: string;
  description: string;
  category: string;
  inLabel: string;
  outLabel: string;
  inSymSchemaIds: string[] | 'any';
  outSymSchemaIds: string[] | 'any';
  fields: Array<{
    id: string;
    name: string;
    type: 'select';
    enumId: string;
    requirementLevel: 'required' | 'expected' | 'optional';
  }>;
  color: string;
  icon: string;
};

export type SchemaTemplate = {
  id: string;
  name: string;
  description: string;
  category: 'full' | 'cross-cutting';
  schemas: TemplateSchema[];
  enums: SymbolicEnum[];
  fieldGroups?: SymbolicFieldGroup[];
  relationSchemas?: SymbolicRelationSchema[];
  documentTypes: SymbolicDocumentType[];
  documentTemplates: SymbolicDocumentTemplate[];
  dashboardWidgets?: SymbolicDashboardWidget[];
  capabilityConfigurations?: SymbolicCapabilityConfiguration[];
  views?: SymbolicSavedView[];
};

export type SymbolicCapabilityConfiguration = {
  type: string;
  bindings: Record<string, SymbolicCapabilityBinding>;
};

export type SymbolicCapabilityBinding = {
  target: {
    kind: WorkspaceCapabilityTargetKind;
    symId: string;
  };
  fieldMappings?: Record<string, string>;
};

export type SymbolicFieldGroup = {
  id: string;
  name: string;
  description?: string;
  fields: SymbolicField[];
};

const apiProviderRelationSchema: SymbolicRelationSchema = {
  symId: 'provides-api',
  name: 'Provides API',
  description: 'Associates a Component or System with an API it provides.',
  category: 'Architecture',
  inLabel: 'Provides APIs',
  outLabel: 'Provided by Component or System',
  inSymSchemaIds: ['component', 'system'],
  outSymSchemaIds: ['api'],
  fields: [],
  color: AR_COLOR_GREEN,
  icon: 'plug'
};

const apiConsumerRelationSchema: SymbolicRelationSchema = {
  symId: 'consumes-api',
  name: 'Consumes API',
  description: 'Associates a Component or System with an API it consumes.',
  category: 'Architecture',
  inLabel: 'Consumes APIs',
  outLabel: 'Consumed by Component or System',
  inSymSchemaIds: ['component', 'system'],
  outSymSchemaIds: ['api'],
  fields: [],
  color: AR_COLOR_BLUE,
  icon: 'download'
};

const apiParticipationRelationSchemas = [apiProviderRelationSchema, apiConsumerRelationSchema];

const apiParticipationField = (
  id: string,
  name: string,
  relationSchemaId: string,
  direction: 'in' | 'out'
): SymbolicField => ({
  id,
  name,
  type: 'typedRelation',
  symRelationSchemaId: relationSchemaId,
  direction,
  minCount: 0,
  maxCount: -1
});

const enumDefinition = (
  id: string,
  name: string,
  options: Array<{ value: string; label: string }>
): SymbolicEnum => ({ id, name, options });

const piiClassificationEnum = enumDefinition('pii-classification', 'PII Classification', [
  { value: 'none', label: 'None' },
  { value: 'public', label: 'Public' },
  { value: 'non-sensitive', label: 'Non-Sensitive' },
  { value: 'sensitive', label: 'Sensitive' },
  { value: 'highly-sensitive', label: 'Highly Sensitive' }
]);

const contractPurposeEnum = enumDefinition('contract-purpose', 'Contract Purpose', [
  { value: 'license', label: 'License' },
  { value: 'support', label: 'Support' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'hosting', label: 'Hosting' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'other', label: 'Other' }
]);

const piiClassificationFieldGroup: SymbolicFieldGroup = {
  id: 'pii-classification',
  name: 'PII Classification',
  description: 'Classifies personal data handled by the entity and documents its scope.',
  fields: [
    {
      id: 'pii_classification',
      name: 'PII Classification',
      type: 'select',
      enumId: 'pii-classification'
    },
    { id: 'pii_scope', name: 'PII Scope', type: 'text' }
  ]
};

export const ADR_DOCUMENT_TYPE_NAME = 'Architecture Decision Record';
export const ADR_DOCUMENT_TEMPLATE_NAME = 'Architecture Decision Record';

export const ADR_DOCUMENT_TYPE_DEFINITION: SymbolicDocumentType = {
  id: 'architecture-decision-record',
  name: ADR_DOCUMENT_TYPE_NAME,
  description: 'A structured record of an architecture decision.',
  color: AR_COLOR_PURPLE,
  icon: 'clipboard',
  fields: [
    {
      id: 'status',
      name: 'Status',
      type: 'enum',
      requirement: 'required',
      enumOptions: [
        { value: 'Proposed', label: 'Proposed' },
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Superseded', label: 'Superseded' },
        { value: 'Deprecated', label: 'Deprecated' }
      ],
      retired: false
    },
    {
      id: 'decision_date',
      name: 'Decision date',
      type: 'date',
      requirement: 'expected',
      retired: false
    },
    {
      id: 'affected_entities',
      name: 'Affected entities',
      type: 'entity_link',
      requirement: 'optional',
      minCardinality: 0,
      retired: false
    },
    {
      id: 'supersedes',
      name: 'Supersedes',
      type: 'document_link',
      requirement: 'optional',
      minCardinality: 0,
      inverseName: 'Superseded by',
      retired: false
    }
  ]
};

export const ADR_DOCUMENT_TEMPLATE_DEFINITION: SymbolicDocumentTemplate = {
  id: 'architecture-decision-record-template',
  name: ADR_DOCUMENT_TEMPLATE_NAME,
  body: '# {{title}}\n\n## Context\n\n## Decision drivers\n\n## Considered options\n\n## Decision\n\n## Consequences\n',
  documentTypeId: ADR_DOCUMENT_TYPE_DEFINITION.id,
  metadataDefaults: { status: 'Proposed' }
};

const commonDocumentTypes = [ADR_DOCUMENT_TYPE_DEFINITION];
const commonDocumentTemplates = [ADR_DOCUMENT_TEMPLATE_DEFINITION];

const generateTemplateSchemaKeyPrefix = (workspaceId: string, schemaId: string) => {
  const bytes = createHash('sha1').update(`${workspaceId}:${schemaId}`).digest();
  let prefix = '';
  for (const byte of bytes) {
    prefix += String.fromCharCode(65 + (byte % 26));
    if (prefix.length === 5) break;
  }
  return prefix;
};

export const LADR_DOCUMENT_TYPE_NAME = 'Lightweight Architecture Decision Record';
export const LADR_DOCUMENT_TEMPLATE_NAME = 'Lightweight Architecture Decision Record';

export const LADR_DOCUMENT_TYPE_DEFINITION: SymbolicDocumentType = {
  id: 'lightweight-architecture-decision-record',
  name: LADR_DOCUMENT_TYPE_NAME,
  description: 'A concise, low-ceremony record of an architecture decision.',
  color: AR_COLOR_PURPLE,
  icon: 'clipboard',
  fields: [
    {
      id: 'status',
      name: 'Status',
      type: 'enum',
      requirement: 'required',
      enumOptions: [
        { value: 'Proposed', label: 'Proposed' },
        { value: 'Accepted', label: 'Accepted' },
        { value: 'Superseded', label: 'Superseded' },
        { value: 'Deprecated', label: 'Deprecated' }
      ],
      retired: false
    },
    {
      id: 'decision_date',
      name: 'Decision date',
      type: 'date',
      requirement: 'expected',
      retired: false
    }
  ]
};

export const LADR_DOCUMENT_TEMPLATE_DEFINITION: SymbolicDocumentTemplate = {
  id: 'lightweight-architecture-decision-record-template',
  name: LADR_DOCUMENT_TEMPLATE_NAME,
  body: '# {{title}}\n\n## Decision\n\n## Rationale\n',
  documentTypeId: LADR_DOCUMENT_TYPE_DEFINITION.id,
  metadataDefaults: { status: 'Proposed' }
};

const lightweightDocumentTypes = [LADR_DOCUMENT_TYPE_DEFINITION];
const lightweightDocumentTemplates = [LADR_DOCUMENT_TEMPLATE_DEFINITION];

const backstageEnums = [
  enumDefinition('api-type', 'API Type', [
    { value: 'openapi', label: 'OpenAPI' },
    { value: 'grpc', label: 'gRPC' },
    { value: 'graphql', label: 'GraphQL' },
    { value: 'asyncapi', label: 'AsyncAPI' }
  ]),
  enumDefinition('component-kind', 'Component Kind', [
    { value: 'service', label: 'Service' },
    { value: 'library', label: 'Library' },
    { value: 'website', label: 'Website' },
    { value: 'documentation', label: 'Documentation' }
  ]),
  enumDefinition('resource-kind', 'Resource Kind', [
    { value: 'database', label: 'Database' },
    { value: 'cache', label: 'Cache' },
    { value: 'queue', label: 'Queue' },
    { value: 'blob-storage', label: 'Blob Storage' }
  ])
];

const itilEnums = [
  enumDefinition('application-tier', 'Application Tier', [
    { value: 'strategic', label: 'Strategic' },
    { value: 'tactical', label: 'Tactical' },
    { value: 'commodity', label: 'Commodity' }
  ]),
  enumDefinition('host-type', 'Host Type', [
    { value: 'physical', label: 'Physical' },
    { value: 'virtual', label: 'Virtual' },
    { value: 'container', label: 'Container' }
  ]),
  enumDefinition('environment', 'Environment', [
    { value: 'development', label: 'Development' },
    { value: 'test', label: 'Test' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Production' }
  ])
];

const dddEnums = [
  enumDefinition('service-kind', 'Service Kind', [
    { value: 'domain', label: 'Domain' },
    { value: 'application', label: 'Application' },
    { value: 'infrastructure', label: 'Infrastructure' }
  ]),
  enumDefinition('event-type', 'Event Type', [
    { value: 'command', label: 'Command' },
    { value: 'event', label: 'Event' },
    { value: 'query', label: 'Query' }
  ])
];

const teamTopologiesEnums = [
  enumDefinition('team-type', 'Team Type', [
    { value: 'stream-aligned', label: 'Stream-aligned' },
    { value: 'platform', label: 'Platform' },
    { value: 'enabling', label: 'Enabling' },
    { value: 'complicated-subsystem', label: 'Complicated Subsystem' }
  ]),
  enumDefinition('interaction-mode', 'Interaction Mode', [
    { value: 'collaboration', label: 'Collaboration' },
    { value: 'x-as-a-service', label: 'X-as-a-Service' },
    { value: 'facilitating', label: 'Facilitating' }
  ])
];

const dataMeshEnums = [
  enumDefinition('data-product-type', 'Data Product Type', [
    { value: 'source-aligned', label: 'Source-aligned' },
    { value: 'aggregate', label: 'Aggregate' },
    { value: 'consumer-aligned', label: 'Consumer-aligned' }
  ]),
  enumDefinition('dataset-format', 'Dataset Format', [
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
    { value: 'avro', label: 'Avro' },
    { value: 'parquet', label: 'Parquet' },
    { value: 'relational', label: 'Relational' }
  ])
];

const archimateEnums = [
  enumDefinition('layer', 'Layer', [
    { value: 'business', label: 'Business' },
    { value: 'application', label: 'Application' },
    { value: 'technology', label: 'Technology' }
  ]),
  enumDefinition('technology-kind', 'Technology Kind', [
    { value: 'device', label: 'Device' },
    { value: 'system-software', label: 'System Software' },
    { value: 'artifact', label: 'Artifact' }
  ])
];

const technologyEnums = [
  enumDefinition('technology-category', 'Technology Category', [
    { value: 'language', label: 'Language' },
    { value: 'framework', label: 'Framework' },
    { value: 'database', label: 'Database' },
    { value: 'operating-system', label: 'Operating System' },
    { value: 'runtime', label: 'Runtime' },
    { value: 'library', label: 'Library' }
  ]),
  enumDefinition('technology-radar-status', 'Technology Radar Status', [
    { value: 'adopt', label: 'Adopt' },
    { value: 'trial', label: 'Trial' },
    { value: 'assess', label: 'Assess' },
    { value: 'hold', label: 'Hold' }
  ])
];

const technologySchema: TemplateSchema = {
  symId: 'technology',
  name: 'Technology',
  description: 'A technology product tracked for governance and planning.',
  category: 'Technology',
  color: AR_COLOR_BLUE,
  icon: 'chip',
  fields: [
    { id: 'product', name: 'Product', type: 'text' },
    { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
    { id: 'category', name: 'Category', type: 'select', enumId: 'technology-category' },
    { id: 'radar_status', name: 'Radar Status', type: 'select', enumId: 'technology-radar-status' }
  ]
};

const technologyReleaseSchema: TemplateSchema = {
  symId: 'technology_release',
  name: 'Technology Release',
  description:
    'A product release cycle tracked for support lifecycle, technology radar governance, and planning.',
  category: 'Technology',
  color: AR_COLOR_BLUE,
  icon: 'cpu',
  fields: [
    {
      id: 'technology',
      name: 'Technology',
      predicate: 'belongs to',
      type: 'containment',
      symSchemaId: 'technology',
      minCount: 1,
      maxCount: 1
    },
    { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
    { id: 'release_cycle', name: 'Release Cycle', type: 'text' },
    { id: 'latest_version', name: 'Latest Version', type: 'text' },
    { id: 'release_date', name: 'Release Date', type: 'date' },
    { id: 'active_support_until', name: 'Active Support Until', type: 'date' },
    { id: 'security_support_until', name: 'Security Support Until', type: 'date' },
    { id: 'eol_date', name: 'EOL Date', type: 'date' },
    { id: 'source_url', name: 'Source URL', type: 'text' },
    { id: 'last_synchronized', name: 'Last Synchronized', type: 'date' },
    { id: 'category', name: 'Category', type: 'select', enumId: 'technology-category' },
    { id: 'radar_status', name: 'Radar Status', type: 'select', enumId: 'technology-radar-status' }
  ]
};

const technologyReleaseReference = (): SymbolicField => ({
  id: 'technology_releases',
  name: 'Technology Releases',
  predicate: 'uses',
  type: 'reference',
  symSchemaId: 'technology_release',
  minCount: 0,
  maxCount: -1
});

const glossaryStatusEnum = enumDefinition('glossary-status', 'Glossary Status', [
  { value: 'draft', label: 'Draft' },
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' }
]);

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

const strategyStatusEnum = enumDefinition('strategy-status', 'Strategy Status', [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'achieved', label: 'Achieved' },
  { value: 'abandoned', label: 'Abandoned' }
]);

const strategySchemas: TemplateSchema[] = [
  {
    symId: 'objective',
    name: 'Objective',
    description: 'A strategic objective the organization is pursuing.',
    category: 'Strategy',
    color: AR_COLOR_PURPLE,
    icon: 'target',
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'status', name: 'Status', type: 'select', enumId: 'strategy-status' },
      { id: 'target_date', name: 'Target Date', type: 'date' },
      {
        id: 'supported_entities',
        name: 'Supports',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-supports-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'affected_entities',
        name: 'Affects',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-affects-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      }
    ]
  },
  {
    symId: 'outcome',
    name: 'Outcome',
    description: 'A measurable outcome that indicates progress toward one or more Objectives.',
    category: 'Strategy',
    color: AR_COLOR_BLUE,
    icon: 'flag',
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      {
        id: 'objectives',
        name: 'Objectives',
        predicate: 'supports',
        type: 'reference',
        symSchemaId: 'objective',
        minCount: 0,
        maxCount: -1
      }
    ]
  },
  {
    symId: 'initiative',
    name: 'Initiative',
    description: 'A body of work undertaken to pursue an Objective or Outcome.',
    category: 'Strategy',
    color: AR_COLOR_GREEN,
    icon: 'rocket',
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'status', name: 'Status', type: 'select', enumId: 'strategy-status' },
      {
        id: 'objectives',
        name: 'Objectives',
        predicate: 'pursues',
        type: 'reference',
        symSchemaId: 'objective',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'outcomes',
        name: 'Outcomes',
        predicate: 'pursues',
        type: 'reference',
        symSchemaId: 'outcome',
        minCount: 0,
        maxCount: -1
      }
    ]
  },
  {
    symId: 'measure',
    name: 'Measure',
    description: 'A metric or KPI used to track progress on an Outcome.',
    category: 'Strategy',
    color: AR_COLOR_ORANGE,
    icon: 'chart-bar',
    fields: [
      { id: 'description', name: 'Description', type: 'longtext' },
      { id: 'unit', name: 'Unit', type: 'text' },
      { id: 'target_value', name: 'Target Value', type: 'number' },
      {
        id: 'outcomes',
        name: 'Outcomes',
        predicate: 'measures',
        type: 'reference',
        symSchemaId: 'outcome',
        minCount: 0,
        maxCount: -1
      }
    ]
  }
];

const strategyRelationSchemas: SymbolicRelationSchema[] = [
  {
    symId: 'objective-supports-entity',
    name: 'Objective Supports Entity',
    description: 'Associates an Objective with an entity that supports or enables it.',
    category: 'Strategy',
        inLabel: 'Supports Entities',
        outLabel: 'Supported by Objective',
    inSymSchemaIds: ['objective'],
    outSymSchemaIds: 'any',
    fields: [],
    color: AR_COLOR_PURPLE,
    icon: 'target'
  },
  {
    symId: 'objective-affects-entity',
    name: 'Objective Affects Entity',
    description: 'Associates an Objective with an architecture entity it affects.',
    category: 'Strategy',
    inLabel: 'Affects Entities',
    outLabel: 'Affected by Objective',
    inSymSchemaIds: ['objective'],
    outSymSchemaIds: 'any',
    fields: [],
    color: AR_COLOR_BLUE,
    icon: 'target'
  }
];

const securityEnums = [
  enumDefinition('classification', 'Classification', [
    { value: 'public', label: 'Public' },
    { value: 'internal', label: 'Internal' },
    { value: 'confidential', label: 'Confidential' },
    { value: 'restricted', label: 'Restricted' }
  ]),
  enumDefinition('asset-type', 'Asset Type', [
    { value: 'data', label: 'Data' },
    { value: 'service', label: 'Service' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'credential', label: 'Credential' }
  ]),
  enumDefinition('stride-category', 'STRIDE Category', [
    { value: 'spoofing', label: 'Spoofing' },
    { value: 'tampering', label: 'Tampering' },
    { value: 'repudiation', label: 'Repudiation' },
    { value: 'information-disclosure', label: 'Information Disclosure' },
    { value: 'denial-of-service', label: 'Denial of Service' },
    { value: 'elevation-of-privilege', label: 'Elevation of Privilege' }
  ]),
  enumDefinition('control-type', 'Control Type', [
    { value: 'preventive', label: 'Preventive' },
    { value: 'detective', label: 'Detective' },
    { value: 'corrective', label: 'Corrective' }
  ]),
  enumDefinition('likelihood', 'Likelihood', [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ]),
  enumDefinition('impact', 'Impact', [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' }
  ])
];

const riskComplianceEnums = [
  enumDefinition('risk-status', 'Risk Status', [
    { value: 'open', label: 'Open' },
    { value: 'mitigating', label: 'Mitigating' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'closed', label: 'Closed' }
  ]),
  enumDefinition('risk-mitigation-effectiveness', 'Mitigation Effectiveness', [
    { value: 'none', label: 'None' },
    { value: 'partial', label: 'Partial' },
    { value: 'substantial', label: 'Substantial' },
    { value: 'full', label: 'Full' }
  ]),
  enumDefinition('rc-control-type', 'Control Type', [
    { value: 'preventive', label: 'Preventive' },
    { value: 'detective', label: 'Detective' },
    { value: 'corrective', label: 'Corrective' },
    { value: 'compensating', label: 'Compensating' }
  ]),
  enumDefinition('control-effectiveness', 'Control Effectiveness', [
    { value: 'effective', label: 'Effective' },
    { value: 'partially-effective', label: 'Partially Effective' },
    { value: 'ineffective', label: 'Ineffective' },
    { value: 'not-tested', label: 'Not Tested' }
  ]),
  enumDefinition('framework-kind', 'Framework Kind', [
    { value: 'soc2', label: 'SOC 2' },
    { value: 'iso27001', label: 'ISO 27001' },
    { value: 'nist', label: 'NIST' },
    { value: 'custom', label: 'Custom' }
  ]),
  enumDefinition('requirement-status', 'Requirement Status', [
    { value: 'not-started', label: 'Not Started' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'met', label: 'Met' },
    { value: 'not-applicable', label: 'Not Applicable' }
  ])
];

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
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
  },
  {
    id: 'default',
    category: 'full',
    name: 'Default',
    description:
      'Diagram Craft default catalog — Domain, System, Component, API, Resource, Technology, and Technology Release.',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A high-level grouping that owns one or more Systems.',
        category: 'Architecture',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'system',
        name: 'System',
        description:
          'A collection of resources that exposes one or more APIs to users and other Systems.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'domain',
            name: 'Domain',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 1,
            maxCount: 1
          },
          apiParticipationField('provides_apis', 'Provides APIs', 'provides-api', 'in'),
          apiParticipationField('consumes_apis', 'Consumes APIs', 'consumes-api', 'in'),
          {
            id: 'contracts',
            name: 'Uses',
            type: 'typedRelation',
            symRelationSchemaId: 'system-contract',
            direction: 'out',
            minCount: 0,
            maxCount: -1
          }
        ],
        sharedFieldGroupIds: ['pii-classification']
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A deployable unit of code within a System (service, library, website, etc.).',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          technologyReleaseReference(),
          {
            id: 'system',
            name: 'Used by',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 1,
            maxCount: 1
          },
            apiParticipationField('provides_apis', 'Provides APIs', 'provides-api', 'in'),
            apiParticipationField('consumes_apis', 'Consumes APIs', 'consumes-api', 'in'),
          {
            id: 'depends_on',
            name: 'Depends On',
            predicate: 'depends on',
            type: 'reference',
            symSchemaId: 'component',
            minCount: 0,
            maxCount: -1
          }
        ],
        sharedFieldGroupIds: ['pii-classification']
      },
      {
        symId: 'api',
        name: 'API',
        description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
        category: 'Architecture',
        color: AR_COLOR_BLUE,
        icon: 'api',
        fields: [
          { id: 'api_type', name: 'Type', type: 'select', enumId: 'api-type' },
          {
            id: 'system',
            name: 'System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 1,
            maxCount: 1
          },
          { id: 'api_version', name: 'API Version', type: 'text' },
          apiParticipationField('providers', 'Provided by', 'provides-api', 'out'),
          apiParticipationField('consumers', 'Consumed by', 'consumes-api', 'out')
        ],
        sharedFieldGroupIds: ['pii-classification']
      },
      {
        symId: 'resource',
        name: 'Resource',
        description:
          'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
        category: 'Technology',
        color: AR_COLOR_ORANGE,
        icon: 'database',
        fields: [
          { id: 'resource_type', name: 'Type', type: 'text' },
          technologyReleaseReference(),
          {
            id: 'system',
            name: 'System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'contract',
        name: 'Contract',
        description: 'A commercial agreement with a vendor supporting a System.',
        category: 'Vendor',
        color: AR_COLOR_ORANGE,
        icon: 'certificate',
        fields: [
          {
            id: 'vendor',
            name: 'Vendor',
            predicate: 'provided by',
            type: 'containment',
            symSchemaId: 'vendor',
            minCount: 1,
            maxCount: 1
          },
          { id: 'contract_start', name: 'Contract Start', type: 'date' },
          { id: 'contract_end', name: 'Contract End', type: 'date' },
          { id: 'annual_cost', name: 'Annual Cost', type: 'currency' },
          { id: 'setup_fee', name: 'Setup Fee', type: 'currency' },
          {
            id: 'system',
            name: 'System',
            type: 'typedRelation',
            symRelationSchemaId: 'system-contract',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'vendor',
        name: 'Vendor',
        description: 'A company that provides products or services under one or more Contracts.',
        category: 'Vendor',
        color: AR_COLOR_BLUE,
        icon: 'building',
        fields: []
      },
      technologySchema,
      technologyReleaseSchema
    ],
    enums: [backstageEnums[0]!, piiClassificationEnum, contractPurposeEnum, ...technologyEnums],
    fieldGroups: [piiClassificationFieldGroup],
    relationSchemas: [
      ...apiParticipationRelationSchemas,
      {
        symId: 'system-contract',
        name: 'System Contract',
        description:
          'Associates a System with a vendor Contract and records the agreement purpose.',
        category: 'Architecture',
        inLabel: 'Uses Contract',
        outLabel: 'Used by System',
        inSymSchemaIds: ['system'],
        outSymSchemaIds: ['contract'],
        fields: [
          {
            id: 'purpose',
            name: 'Purpose',
            type: 'select',
            enumId: 'contract-purpose',
            requirementLevel: 'required'
          }
        ],
        color: AR_COLOR_ORANGE,
        icon: 'certificate'
      }
    ],
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates,
    capabilityConfigurations: [
      {
        type: 'api-specification',
        bindings: {
          api: {
            target: { kind: 'entity_schema', symId: 'api' }
          }
        }
      }
    ]
  },
  {
    id: 'backstage',
    category: 'full',
    name: 'Backstage',
    description: 'CNCF Backstage Software Catalog — Domain, System, Component, API, Resource',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A high-level grouping that owns one or more Systems.',
        category: 'Architecture',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'system',
        name: 'System',
        description:
          'A collection of resources that exposes one or more APIs to users and other Systems.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'domain',
            name: 'Domain',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          },
            apiParticipationField('provides_apis', 'Provides APIs', 'provides-api', 'in'),
            apiParticipationField('consumes_apis', 'Consumes APIs', 'consumes-api', 'in')
        ]
      },
      {
        symId: 'api',
        name: 'API',
        description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
        category: 'Architecture',
        color: AR_COLOR_BLUE,
        icon: 'api',
        fields: [
          { id: 'api_type', name: 'Type', type: 'select', enumId: 'api-type' },
          {
            id: 'system',
            name: 'System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          },
          { id: 'api_version', name: 'API Version', type: 'text' },
          apiParticipationField('providers', 'Provided by', 'provides-api', 'out'),
          apiParticipationField('consumers', 'Consumed by', 'consumes-api', 'out')
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A deployable unit of code within a System (service, library, website, etc.).',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: 'component-kind' },
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'go_live_date', name: 'Go Live Date', type: 'date' },
          {
            id: 'system',
            name: 'System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          },
            apiParticipationField('provides_apis', 'Provides APIs', 'provides-api', 'in'),
            apiParticipationField('consumes_apis', 'Consumes APIs', 'consumes-api', 'in')
        ]
      },
      {
        symId: 'resource',
        name: 'Resource',
        description:
          'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
        category: 'Technology',
        color: AR_COLOR_ORANGE,
        icon: 'database',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: 'resource-kind' },
          { id: 'planned_decommission', name: 'Planned Decommission', type: 'date' },
          {
            id: 'system',
            name: 'System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          }
        ]
      }
    ],
    enums: backstageEnums,
    relationSchemas: apiParticipationRelationSchemas,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates,
    capabilityConfigurations: [
      {
        type: 'api-specification',
        bindings: {
          api: {
            target: { kind: 'entity_schema', symId: 'api' }
          }
        }
      }
    ]
  },
  {
    id: 'c4',
    category: 'full',
    name: 'C4 Model',
    description: 'C4 Model by Simon Brown — Person, Software System, Container, Component',
    schemas: [
      {
        symId: 'person',
        name: 'Person',
        description: 'A user or actor that interacts with one or more Software Systems.',
        category: 'Organization',
        color: AR_COLOR_YELLOW,
        icon: 'user',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'software_system',
        name: 'Software System',
        description: 'The highest level of abstraction — something that delivers value to users.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'container',
        name: 'Container',
        description:
          'A separately deployable/runnable unit within a Software System (app, service, DB, etc.).',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'description', name: 'Description', type: 'longtext' },
          {
            id: 'system',
            name: 'Software System',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'software_system',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A grouping of related functionality within a Container.',
        category: 'Architecture',
        color: AR_COLOR_BLUE,
        icon: 'settings',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'container',
            name: 'Container',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'container',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            predicate: 'depends on',
            type: 'reference',
            symSchemaId: 'component',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: [],
    documentTypes: lightweightDocumentTypes,
    documentTemplates: lightweightDocumentTemplates
  },
  {
    id: 'itil',
    category: 'full',
    name: 'CMDB / ITIL',
    description:
      'IT Service Management — Organization, Business Service, Application, Database, Host',
    schemas: [
      {
        symId: 'organization',
        name: 'Organization',
        description: 'A business unit or department that owns one or more Business Services.',
        category: 'Organization',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'business_service',
        name: 'Business Service',
        description:
          'An IT-enabled capability delivered to the business by one or more Applications.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'organization',
            name: 'Organization',
            type: 'containment',
            symSchemaId: 'organization',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'application',
        name: 'Application',
        description: 'A software application that supports a Business Service.',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'tier', name: 'Tier', type: 'select', enumId: 'application-tier' },
          { id: 'sunset_date', name: 'Sunset Date', type: 'date' },
          {
            id: 'service',
            name: 'Business Service',
            type: 'containment',
            symSchemaId: 'business_service',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'database',
        name: 'Database',
        description: 'A data store used by one or more Applications.',
        category: 'Technology',
        color: AR_COLOR_PURPLE,
        icon: 'database',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'application',
            name: 'Application',
            type: 'reference',
            symSchemaId: 'application',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'host',
        name: 'Host',
        description: 'A physical or virtual machine that runs Applications and Databases.',
        category: 'Technology',
        color: AR_COLOR_ORANGE,
        icon: 'server',
        fields: [
          { id: 'host_type', name: 'Type', type: 'select', enumId: 'host-type' },
          { id: 'environment', name: 'Environment', type: 'select', enumId: 'environment' },
          { id: 'patch_deadline', name: 'Patch Deadline', type: 'date' },
          {
            id: 'applications',
            name: 'Applications',
            type: 'reference',
            symSchemaId: 'application',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'databases',
            name: 'Databases',
            type: 'reference',
            symSchemaId: 'database',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: itilEnums,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates
  },
  {
    id: 'ddd',
    category: 'full',
    name: 'Domain-Driven',
    description: 'Simple DDD-inspired model — Domain, Team, Service, Event',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A bounded context representing a distinct area of business knowledge.',
        category: 'Architecture',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'team',
        name: 'Team',
        description: 'An engineering team that owns one or more Services.',
        category: 'Organization',
        color: AR_COLOR_ORANGE,
        icon: 'users',
        fields: []
      },
      {
        symId: 'service',
        name: 'Service',
        description: 'A deployable unit that implements domain logic within a bounded context.',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'kind', name: 'Kind', type: 'select', enumId: 'service-kind' },
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'event',
        name: 'Event',
        description:
          'An asynchronous message (command, event, or query) exchanged between Services.',
        category: 'Architecture',
        color: AR_COLOR_BLUE,
        icon: 'zap',
        fields: [
          { id: 'event_type', name: 'Type', type: 'select', enumId: 'event-type' },
          {
            id: 'producer',
            name: 'Producer',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'consumers',
            name: 'Consumers',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: dddEnums,
    documentTypes: lightweightDocumentTypes,
    documentTemplates: lightweightDocumentTemplates
  },
  {
    id: 'team-topologies',
    category: 'full',
    name: 'Team Topologies',
    description: "Conway's Law model — Team, System, API (interaction modes)",
    schemas: [
      {
        symId: 'team',
        name: 'Team',
        description:
          'An engineering team classified by its topology type (stream-aligned, platform, enabling, complicated-subsystem).',
        category: 'Organization',
        color: AR_COLOR_YELLOW,
        icon: 'users',
        fields: [
          { id: 'team_type', name: 'Type', type: 'select', enumId: 'team-type' },
          { id: 'cognitive_load', name: 'Cognitive Load Notes', type: 'longtext' }
        ]
      },
      {
        symId: 'system',
        name: 'System',
        description: 'A software system owned by a Team.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'owning_team',
            name: 'Owning Team',
            type: 'containment',
            symSchemaId: 'team',
            minCount: 0,
            maxCount: 1
          },
          { id: 'description', name: 'Description', type: 'longtext' }
        ]
      },
      {
        symId: 'interaction',
        name: 'Team Interaction',
        description:
          'A defined collaboration mode between two Teams (collaboration, X-as-a-Service, facilitating).',
        category: 'Organization',
        color: AR_COLOR_BLUE,
        icon: 'arrow-right',
        fields: [
          { id: 'mode', name: 'Mode', type: 'select', enumId: 'interaction-mode' },
          {
            id: 'from_team',
            name: 'From Team',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'to_team',
            name: 'To Team',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          { id: 'expected_duration', name: 'Expected Duration', type: 'text' }
        ]
      }
    ],
    enums: teamTopologiesEnums,
    documentTypes: lightweightDocumentTypes,
    documentTemplates: lightweightDocumentTemplates
  },
  {
    id: 'data-mesh',
    category: 'full',
    name: 'Data Mesh',
    description:
      'Data Mesh by Zhamak Dehghani — Domain, Data Product, Dataset, Pipeline, Source System',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A business domain that owns one or more Data Products.',
        category: 'Data',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'source_system',
        name: 'Source System',
        description: 'An operational system that produces raw data consumed by Data Products.',
        category: 'Data',
        color: AR_COLOR_PURPLE,
        icon: 'database',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'data_product',
        name: 'Data Product',
        description: 'A self-contained, domain-owned data asset with defined SLOs.',
        category: 'Data',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'dp_type', name: 'Type', type: 'select', enumId: 'data-product-type' },
          { id: 'slo', name: 'SLOs', type: 'longtext' },
          { id: 'review_date', name: 'Review Date', type: 'date' },
          {
            id: 'domain',
            name: 'Domain',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'source_systems',
            name: 'Source Systems',
            type: 'reference',
            symSchemaId: 'source_system',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'dataset',
        name: 'Dataset',
        description: 'A versioned, schema-defined output port of a Data Product.',
        category: 'Data',
        color: AR_COLOR_BLUE,
        icon: 'table',
        fields: [
          { id: 'format', name: 'Format', type: 'select', enumId: 'dataset-format' },
          { id: 'schema_url', name: 'Schema URL', type: 'text' },
          { id: 'deprecation_date', name: 'Deprecation Date', type: 'date' },
          {
            id: 'data_product',
            name: 'Data Product',
            type: 'containment',
            symSchemaId: 'data_product',
            minCount: 1,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'pipeline',
        name: 'Pipeline',
        description: 'A data transformation job that consumes and produces Datasets.',
        category: 'Data',
        color: AR_COLOR_ORANGE,
        icon: 'git-branch',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          {
            id: 'inputs',
            name: 'Inputs',
            type: 'reference',
            symSchemaId: 'dataset',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'outputs',
            name: 'Outputs',
            type: 'reference',
            symSchemaId: 'dataset',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: dataMeshEnums,
    documentTypes: lightweightDocumentTypes,
    documentTemplates: lightweightDocumentTemplates
  },
  {
    id: 'archimate',
    category: 'full',
    name: 'ArchiMate / TOGAF',
    description: 'The Open Group EA framework — Business, Application, and Technology layers',
    schemas: [
      {
        symId: 'business_capability',
        name: 'Business Capability',
        description: 'A high-level ability the organisation needs to execute its strategy.',
        category: 'Architecture',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: [
          {
            id: 'parent',
            name: 'Parent Capability',
            type: 'containment',
            symSchemaId: 'business_capability',
            minCount: 0,
            maxCount: 1
          },
          { id: 'target_date', name: 'Target Date', type: 'date' }
        ]
      },
      {
        symId: 'business_process',
        name: 'Business Process',
        description: 'A sequence of activities that realises a Business Capability.',
        category: 'Architecture',
        color: AR_COLOR_ORANGE,
        icon: 'git-merge',
        fields: [
          {
            id: 'capability',
            name: 'Capability',
            type: 'containment',
            symSchemaId: 'business_capability',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'application_component',
        name: 'Application Component',
        description: 'A modular part of the application layer that realises a Business Process.',
        category: 'Architecture',
        color: AR_COLOR_GREEN,
        icon: 'box',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'layer', name: 'Layer', type: 'select', enumId: 'layer' },
          { id: 'retirement_date', name: 'Retirement Date', type: 'date' },
          {
            id: 'realises',
            name: 'Realises Process',
            type: 'reference',
            symSchemaId: 'business_process',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'application_service',
        name: 'Application Service',
        description: 'An externally visible function exposed by an Application Component.',
        category: 'Architecture',
        color: AR_COLOR_BLUE,
        icon: 'api',
        fields: [
          {
            id: 'component',
            name: 'Component',
            type: 'containment',
            symSchemaId: 'application_component',
            minCount: 0,
            maxCount: 1
          }
        ]
      },
      {
        symId: 'technology_component',
        name: 'Technology Component',
        description:
          'Infrastructure that hosts and runs Application Components (device, system software, artifact).',
        category: 'Technology',
        color: AR_COLOR_PURPLE,
        icon: 'server',
        fields: [
          { id: 'technology', name: 'Technology', type: 'text' },
          { id: 'kind', name: 'Kind', type: 'select', enumId: 'technology-kind' },
          { id: 'end_of_support', name: 'End of Support', type: 'date' },
          {
            id: 'hosts',
            name: 'Hosts',
            type: 'reference',
            symSchemaId: 'application_component',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: archimateEnums,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates
  },
  {
    id: 'security',
    category: 'cross-cutting',
    name: 'Security / Threat Model',
    description: 'STRIDE-adjacent model — Asset, Control, Threat, Risk',
    schemas: [
      {
        symId: 'asset',
        name: 'Asset',
        description:
          'A data, service, infrastructure, or credential item that requires protection.',
        category: 'Security',
        color: AR_COLOR_YELLOW,
        icon: 'shield',
        fields: [
          {
            id: 'classification',
            name: 'Classification',
            type: 'select',
            enumId: 'classification'
          },
          { id: 'asset_type', name: 'Type', type: 'select', enumId: 'asset-type' }
        ]
      },
      {
        symId: 'threat',
        name: 'Threat',
        description: 'A potential adverse action classified by STRIDE category.',
        category: 'Security',
        color: AR_COLOR_RED,
        icon: 'alert-triangle',
        fields: [
          {
            id: 'stride_category',
            name: 'STRIDE Category',
            type: 'select',
            enumId: 'stride-category'
          },
          { id: 'discovered_on', name: 'Discovered On', type: 'date' },
          {
            id: 'affected_assets',
            name: 'Affected Assets',
            type: 'reference',
            symSchemaId: 'asset',
            minCount: 0,
            maxCount: -1
          },
          { id: 'description', name: 'Description', type: 'longtext' }
        ]
      },
      {
        symId: 'control',
        name: 'Control',
        description: 'A safeguard or countermeasure that mitigates one or more Threats.',
        category: 'Security',
        color: AR_COLOR_GREEN,
        icon: 'check-circle',
        fields: [
          { id: 'control_type', name: 'Type', type: 'select', enumId: 'control-type' },
          { id: 'last_verified', name: 'Last Verified', type: 'date' },
          {
            id: 'mitigates',
            name: 'Mitigates',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'protects',
            name: 'Protects',
            type: 'reference',
            symSchemaId: 'asset',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'risk',
        name: 'Risk',
        description:
          'The combination of a Threat and its potential impact, rated by likelihood and severity.',
        category: 'Security',
        color: AR_COLOR_YELLOW,
        icon: 'zap',
        fields: [
          { id: 'likelihood', name: 'Likelihood', type: 'select', enumId: 'likelihood' },
          { id: 'impact', name: 'Impact', type: 'select', enumId: 'impact' },
          { id: 'review_due', name: 'Review Due', type: 'date' },
          {
            id: 'threat',
            name: 'Threat',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'controls',
            name: 'Controls',
            type: 'reference',
            symSchemaId: 'control',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: securityEnums,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates
  },
  {
    id: 'risk-compliance',
    category: 'cross-cutting',
    name: 'Risk & Compliance',
    description: 'Risk register with control mitigation and compliance-framework traceability.',
    schemas: [
      {
        symId: 'risk',
        name: 'Risk',
        description: 'A potential adverse event rated by likelihood and impact.',
        category: 'Governance',
        color: AR_COLOR_RED,
        icon: 'alert-octagon',
        fields: [
          { id: 'likelihood', name: 'Likelihood', type: 'number', min: 1, max: 5 },
          { id: 'impact', name: 'Impact', type: 'number', min: 1, max: 5 },
          {
            id: 'inherent_risk_score',
            name: 'Inherent Risk Score',
            type: 'derived',
            expression: 'entity.likelihood * entity.impact',
            resultType: 'number'
          },
          {
            id: 'mitigation_effectiveness',
            name: 'Mitigation Effectiveness',
            type: 'select',
            enumId: 'risk-mitigation-effectiveness'
          },
          {
            id: 'residual_risk_score',
            name: 'Residual Risk Score',
            type: 'derived',
            expression:
              "entity.likelihood * (entity.mitigation_effectiveness == 'full' ? 0 : entity.mitigation_effectiveness == 'substantial' ? (entity.impact - 2 < 1 ? 1 : entity.impact - 2) : entity.mitigation_effectiveness == 'partial' ? (entity.impact - 1 < 1 ? 1 : entity.impact - 1) : entity.impact)",
            resultType: 'number'
          },
          { id: 'risk_owner', name: 'Risk Owner', type: 'text' },
          { id: 'status', name: 'Status', type: 'select', enumId: 'risk-status' },
          { id: 'treatment_target_date', name: 'Treatment Target Date', type: 'date' },
          {
            id: 'mitigating_controls',
            name: 'Mitigated by',
            type: 'typedRelation',
            symRelationSchemaId: 'risk-control',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'control',
        name: 'Control',
        description: 'A safeguard that mitigates one or more Risks.',
        category: 'Governance',
        color: AR_COLOR_GREEN,
        icon: 'check-circle',
        fields: [
          { id: 'control_type', name: 'Type', type: 'select', enumId: 'rc-control-type' },
          {
            id: 'design_effectiveness',
            name: 'Design Effectiveness',
            type: 'select',
            enumId: 'control-effectiveness'
          },
          {
            id: 'operating_effectiveness',
            name: 'Operating Effectiveness',
            type: 'select',
            enumId: 'control-effectiveness'
          },
          { id: 'last_verified', name: 'Last Verified', type: 'date' },
          {
            id: 'mitigated_risks',
            name: 'Mitigates',
            type: 'typedRelation',
            symRelationSchemaId: 'risk-control',
            direction: 'out',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'satisfied_requirements',
            name: 'Satisfies',
            type: 'typedRelation',
            symRelationSchemaId: 'control-requirement',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'framework',
        name: 'Framework',
        description:
          'A compliance framework (e.g. SOC 2, ISO 27001, NIST) with a requirement catalog.',
        category: 'Governance',
        color: AR_COLOR_BLUE,
        icon: 'book',
        fields: [
          { id: 'framework_kind', name: 'Kind', type: 'select', enumId: 'framework-kind' },
          { id: 'description', name: 'Description', type: 'longtext' }
        ]
      },
      {
        symId: 'compliance_requirement',
        name: 'Compliance Requirement',
        description: 'A single requirement from a Framework requirement catalog.',
        category: 'Governance',
        color: AR_COLOR_PURPLE,
        icon: 'file-check',
        fields: [
          { id: 'requirement_code', name: 'Requirement Code', type: 'text' },
          { id: 'description', name: 'Description', type: 'longtext' },
          { id: 'status', name: 'Status', type: 'select', enumId: 'requirement-status' },
          {
            id: 'framework',
            name: 'Framework',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'framework',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'satisfying_controls',
            name: 'Satisfied by',
            type: 'typedRelation',
            symRelationSchemaId: 'control-requirement',
            direction: 'out',
            minCount: 0,
            maxCount: -1
          }
        ]
      }
    ],
    enums: riskComplianceEnums,
    relationSchemas: [
      {
        symId: 'risk-control',
        name: 'Risk Mitigation',
        description: 'Associates a Risk with the Controls that mitigate it.',
        category: 'Governance',
        inLabel: 'Mitigated by Control',
        outLabel: 'Mitigates Risk',
        inSymSchemaIds: ['risk'],
        outSymSchemaIds: ['control'],
        fields: [],
        color: AR_COLOR_RED,
        icon: 'shield-check'
      },
      {
        symId: 'control-requirement',
        name: 'Control Compliance',
        description: 'Records that a Control satisfies a ComplianceRequirement.',
        category: 'Governance',
        inLabel: 'Satisfies Compliance Requirements',
        outLabel: 'Satisfied by Control',
        inSymSchemaIds: ['control'],
        outSymSchemaIds: ['compliance_requirement'],
        fields: [],
        color: AR_COLOR_GREEN,
        icon: 'check-circle'
      }
    ],
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates,
    dashboardWidgets: [
      {
        id: 'default-entity-count',
        type: 'Metric',
        config: { metricType: 'entity-count' },
        x: 0,
        y: 0,
        w: 3,
        h: 2
      },
      {
        id: 'default-project-count',
        type: 'Metric',
        config: { metricType: 'project-count' },
        x: 3,
        y: 0,
        w: 3,
        h: 2
      },
      {
        id: 'default-diagram-count',
        type: 'Metric',
        config: { metricType: 'diagram-count' },
        x: 6,
        y: 0,
        w: 3,
        h: 2
      },
      {
        id: 'default-completeness-percent',
        type: 'Metric',
        config: { metricType: 'completeness-percent' },
        x: 9,
        y: 0,
        w: 3,
        h: 2
      },
      {
        id: 'top-risks-by-score',
        type: 'TopEntities',
        config: {
          schema: 'risk',
          fieldId: 'residual_risk_score',
          direction: 'desc',
          limit: 5,
          label: 'Top risks by score'
        },
        x: 0,
        y: 2,
        w: 4,
        h: 2
      },
      {
        id: 'compliance-coverage',
        type: 'AggregateStat',
        config: {
          schema: 'compliance_requirement',
          numeratorCondition: { fieldId: 'status', op: 'equals', value: 'met' },
          label: 'Compliance coverage'
        },
        x: 4,
        y: 2,
        w: 4,
        h: 2
      },
      {
        id: 'overdue-risk-control-reviews',
        type: 'Assessments',
        config: { mode: 'overdue', label: 'Overdue risk and control reviews' },
        x: 8,
        y: 2,
        w: 4,
        h: 2
      },
      { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 4, w: 12, h: 6 }
    ],
    views: [
      {
        id: 'risk-compliance-open-risks-table',
        name: 'Open Risks',
        viewMode: 'table',
        filters: {
          schemaId: 'risk',
          root: { kind: 'predicate', path: [], fieldId: 'status', op: 'equals', value: 'open' }
        },
        config: { table: { fieldIds: ['likelihood', 'impact', 'inherent_risk_score', 'status'] } }
      },
      {
        id: 'risk-compliance-risks-with-controls-table',
        name: 'Risks With Mitigating Controls',
        viewMode: 'table',
        filters: {
          schemaId: 'risk',
          root: {
            kind: 'relationExists',
            path: [
              {
                kind: 'typedRelation',
                fieldId: 'mitigating_controls',
                relationSchemaId: 'risk-control',
                direction: 'in',
                ownerSchemaIds: ['control']
              }
            ]
          }
        },
        config: { table: { fieldIds: ['likelihood', 'impact', 'mitigating_controls'] } }
      }
    ]
  },
  {
    id: 'strategy',
    category: 'cross-cutting',
    name: 'Strategy',
    description:
      'Strategic objectives, outcomes, initiatives, and measures, linked to supporting and affected entities.',
    schemas: strategySchemas,
    enums: [strategyStatusEnum],
    relationSchemas: strategyRelationSchemas,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates,
    capabilityConfigurations: [
      {
        type: 'strategy-model',
        bindings: {
          objective: { target: { kind: 'entity_schema', symId: 'objective' } },
          outcome: { target: { kind: 'entity_schema', symId: 'outcome' } },
          initiative: { target: { kind: 'entity_schema', symId: 'initiative' } },
          measure: { target: { kind: 'entity_schema', symId: 'measure' } }
        }
      }
    ],
    views: [
      {
        id: 'strategy-objectives-table',
        name: 'Objectives',
        viewMode: 'table',
        filters: {
          schemaId: 'objective',
          root: { kind: 'and', children: [] }
        },
        config: { table: { fieldIds: ['status', 'target_date'] } }
      },
      {
        id: 'strategy-initiatives-table',
        name: 'Initiatives',
        viewMode: 'table',
        filters: {
          schemaId: 'initiative',
          root: { kind: 'and', children: [] }
        },
        config: { table: { fieldIds: ['status', 'objectives', 'outcomes'] } }
      }
    ]
  }
];

export const resolveTemplateDashboardWidgets = (
  widgets: readonly SymbolicDashboardWidget[],
  schemaIdMap: ReadonlyMap<string, string>
): DashboardWidget[] =>
  widgets.map(widget => ({
    ...widget,
    config: {
      ...widget.config,
      ...(typeof widget.config.schema === 'string' && {
        schema: schemaIdMap.get(widget.config.schema) ?? widget.config.schema
      })
    }
  }));

const resolvePathStepSchemaIds = (
  step: PathStep,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>
): PathStep => {
  switch (step.kind) {
    case 'forward':
    case 'relationForward':
      return step.filter
        ? {
            ...step,
            filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
          }
        : step;
    case 'backward':
      return {
        ...step,
        ownerSchemaId: idMap.get(step.ownerSchemaId) ?? step.ownerSchemaId,
        ...(step.filter && {
          filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
        })
      };
    case 'typedRelation':
      return {
        ...step,
        relationSchemaId: relationSchemaIdMap.get(step.relationSchemaId) ?? step.relationSchemaId,
        ownerSchemaIds: step.ownerSchemaIds.map(symId => idMap.get(symId) ?? symId),
        ...(step.filter && {
          filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
        })
      };
    case 'unboundTypedRelation':
      return {
        ...step,
        relationSchemaId: relationSchemaIdMap.get(step.relationSchemaId) ?? step.relationSchemaId,
        ...(step.filter && {
          filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
        })
      };
    case 'relationBackward':
      return {
        ...step,
        relationSchemaId: relationSchemaIdMap.get(step.relationSchemaId) ?? step.relationSchemaId,
        ...(step.filter && {
          filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
        })
      };
    case 'endpoint':
      return step;
  }
};

const resolveEntityQueryNodeSchemaIds = (
  node: QueryNode,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>
): QueryNode => {
  switch (node.kind) {
    case 'and':
    case 'or':
      return {
        ...node,
        children: node.children.map(child =>
          resolveEntityQueryNodeSchemaIds(child, idMap, relationSchemaIdMap)
        )
      };
    case 'not':
      return {
        ...node,
        child: resolveEntityQueryNodeSchemaIds(node.child, idMap, relationSchemaIdMap)
      };
    case 'freeText':
      return node;
    case 'predicate':
      return {
        ...node,
        path: node.path.map(step => resolvePathStepSchemaIds(step, idMap, relationSchemaIdMap))
      };
    case 'relationExists':
      return {
        ...node,
        path: node.path.map(step => resolvePathStepSchemaIds(step, idMap, relationSchemaIdMap))
      };
  }
};

const resolveEntityQuerySchemaIds = (
  query: EntityQuery,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>
): EntityQuery => ({
  ...query,
  ...(query.schemaId && { schemaId: idMap.get(query.schemaId) ?? query.schemaId }),
  root: resolveEntityQueryNodeSchemaIds(query.root, idMap, relationSchemaIdMap)
});

const resolveViewModeConfigSchemaIds = (
  mode: string,
  config: Record<string, unknown>,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>
): Record<string, unknown> => {
  switch (mode) {
    case 'radar':
      return {
        ...config,
        ...(typeof config.schemaId === 'string' && {
          schemaId: idMap.get(config.schemaId) ?? config.schemaId
        })
      };
    case 'matrix':
      return {
        ...config,
        ...(typeof config.colSchemaId === 'string' && {
          colSchemaId: idMap.get(config.colSchemaId) ?? config.colSchemaId
        })
      };
    case 'map': {
      const resolved: Record<string, unknown> = { ...config };
      for (const key of ['level1SchemaId', 'level2SchemaId', 'level3SchemaId']) {
        if (typeof config[key] === 'string') {
          resolved[key] = idMap.get(config[key] as string) ?? config[key];
        }
      }
      if (Array.isArray(config.levelConfigs)) {
        resolved.levelConfigs = (config.levelConfigs as Array<Record<string, unknown>>).map(
          level =>
            typeof level.schemaId === 'string'
              ? { ...level, schemaId: idMap.get(level.schemaId) ?? level.schemaId }
              : level
        );
      }
      return resolved;
    }
    case 'explore':
      return {
        ...config,
        ...(typeof config.columnSchemaIds === 'object' &&
          config.columnSchemaIds !== null && {
            columnSchemaIds: Object.fromEntries(
              Object.entries(config.columnSchemaIds as Record<string, string>).map(
                ([key, symId]) => [key, idMap.get(symId) ?? symId]
              )
            )
          })
      };
    case 'graph':
      return {
        ...config,
        ...(Array.isArray(config.relationSchemaIds) && {
          relationSchemaIds: (config.relationSchemaIds as string[]).map(
            symId => relationSchemaIdMap.get(symId) ?? symId
          )
        })
      };
    default:
      return config;
  }
};

const resolveViewConfigSchemaIds = (
  config: Record<string, unknown> | null,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>
): Record<string, unknown> | null => {
  if (!config) return config;
  const resolved: Record<string, unknown> = { ...config };
  for (const mode of ['radar', 'matrix', 'map', 'explore', 'graph']) {
    const modeConfig = config[mode];
    if (modeConfig && typeof modeConfig === 'object') {
      resolved[mode] = resolveViewModeConfigSchemaIds(
        mode,
        modeConfig as Record<string, unknown>,
        idMap,
        relationSchemaIdMap
      );
    }
  }
  return resolved;
};

export const resolveTemplateSavedViews = (
  views: readonly SymbolicSavedView[],
  workspaceId: string,
  idMap: ReadonlyMap<string, string>,
  relationSchemaIdMap: ReadonlyMap<string, string>,
  now: Date
): SavedViewDbCreate[] =>
  views.map(view => ({
    id: randomUUID(),
    workspace: workspaceId,
    project_id: null,
    project_scope: null,
    name: view.name,
    description: view.description ?? null,
    is_admin_view: view.isAdminView ?? false,
    view_mode: view.viewMode,
    filters: resolveEntityQuerySchemaIds(view.filters, idMap, relationSchemaIdMap),
    config: resolveViewConfigSchemaIds(
      view.config,
      idMap,
      relationSchemaIdMap
    ) as SavedViewDbCreate['config'],
    created_at: now,
    updated_at: now
  }));

export type InstantiatedTemplate = {
  schemas: SchemaDbCreate[];
  enums: WorkspaceEnumDbCreate[];
  fieldGroups: SharedFieldGroupDbCreate[];
  relationSchemas: RelationSchemaDbCreate[];
  documentTypes: DocumentTypeDbCreate[];
  documentTemplates: DocumentTemplateDbCreate[];
  dashboardWidgets: DashboardWidget[];
  capabilityConfigurations: Array<{
    type: string;
    bindings: WorkspaceCapabilityBindings;
  }>;
  dashboardGroups: Array<{ name: string; widgets: DashboardWidget[] }>;
  views: SavedViewDbCreate[];
};

export const instantiateTemplateDefinitions = (
  workspaceId: string,
  templateId: string,
  now = new Date()
): InstantiatedTemplate => {
  const template = SCHEMA_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return {
      schemas: [],
      enums: [],
      fieldGroups: [],
      relationSchemas: [],
      documentTypes: [],
      documentTemplates: [],
      dashboardWidgets: [],
      capabilityConfigurations: [],
      dashboardGroups: [],
      views: []
    };
  }

  const idMap = new Map<string, string>();
  for (const schema of template.schemas) {
    idMap.set(schema.symId, randomUUID());
  }
  const enumIdMap = new Map<string, string>();
  for (const enumeration of template.enums) {
    enumIdMap.set(enumeration.id, randomUUID());
  }
  const documentTypeIdMap = new Map<string, string>();
  for (const documentType of template.documentTypes) {
    documentTypeIdMap.set(documentType.id, randomUUID());
  }

  const resolveCapabilityTargetId = (target: {
    kind: WorkspaceCapabilityTargetKind;
    symId: string;
  }) => {
    switch (target.kind) {
      case 'entity_schema':
        return idMap.get(target.symId);
      case 'relation_schema':
        return relationSchemaIdMap.get(target.symId);
      case 'document_type':
        return documentTypeIdMap.get(target.symId);
    }
  };

  const fieldGroupIdMap = new Map<string, string>();
  for (const fieldGroup of template.fieldGroups ?? []) {
    fieldGroupIdMap.set(fieldGroup.id, randomUUID());
  }

  const relationSchemaIdMap = new Map<string, string>();
  for (const relationSchema of template.relationSchemas ?? []) {
    relationSchemaIdMap.set(relationSchema.symId, randomUUID());
  }

  const resolveField = (field: SymbolicField): SchemaField => {
    if (field.type === 'reference') {
      const resolvedId = idMap.get(field.symSchemaId) ?? field.symSchemaId;
      return {
        id: field.id,
        name: field.name,
        predicate: field.predicate,
        type: 'reference',
        schemaId: resolvedId,
        minCount: field.minCount,
        maxCount: field.maxCount,
        requirementLevel: field.minCount > 0 ? 'required' : 'optional'
      };
    }
    if (field.type === 'containment') {
      const resolvedId = idMap.get(field.symSchemaId) ?? field.symSchemaId;
      return {
        id: field.id,
        name: field.name,
        predicate: field.predicate,
        type: 'containment',
        schemaId: resolvedId,
        minCount: field.minCount,
        maxCount: field.maxCount,
        requirementLevel: field.minCount > 0 ? 'required' : 'optional'
      };
    }
    if (field.type === 'select') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        enumId: enumIdMap.get(field.enumId) ?? field.enumId,
        minCardinality: field.minCardinality,
        maxCardinality: field.maxCardinality
      };
    }
    if (field.type === 'typedRelation') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        relationSchemaId:
          relationSchemaIdMap.get(field.symRelationSchemaId) ?? field.symRelationSchemaId,
        direction: field.direction,
        minCount: field.minCount,
        maxCount: field.maxCount
      };
    }
    if (field.type === 'number') {
      return {
        id: field.id,
        name: field.name,
        type: 'number',
        min: field.min,
        max: field.max,
        minCardinality: field.minCardinality,
        maxCardinality: field.maxCardinality
      };
    }
    if (field.type === 'derived') {
      return {
        id: field.id,
        name: field.name,
        type: 'derived',
        requirementLevel: 'optional',
        expression: field.expression,
        resultType: field.resultType,
        enumId:
          field.resultType === 'select' ? (enumIdMap.get(field.enumId!) ?? field.enumId) : undefined
      };
    }
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      minCardinality: field.minCardinality,
      maxCardinality: field.maxCardinality
    };
  };

  const fieldGroups: SharedFieldGroupDbCreate[] = (template.fieldGroups ?? []).map(
    (fieldGroup, index) => ({
      id: fieldGroupIdMap.get(fieldGroup.id)!,
      workspace: workspaceId,
      name: fieldGroup.name,
      description: fieldGroup.description ?? null,
      fields: fieldGroup.fields.map(resolveField),
      sort_order: index,
      created_at: now,
      updated_at: now
    })
  );

  const schemas = template.schemas.map(schema => {
    const resolvedFields: SchemaField[] = schema.fields.map(resolveField);

    return {
      id: idMap.get(schema.symId)!,
      workspace: workspaceId,
      name: schema.name,
      category: schema.category,
      description: schema.description,
      key_prefix: normalizePublicIdPrefix(
        generateTemplateSchemaKeyPrefix(workspaceId, schema.symId)
      ),
      color: schema.color,
      icon: schema.icon,
      fields: resolvedFields,
      shared_field_group_links: (schema.sharedFieldGroupIds ?? []).map(id => ({
        groupId: fieldGroupIdMap.get(id) ?? id
      })),
      default_owner: null,
      created_at: now,
      updated_at: now
    };
  });

  const resolveEndpointSchemaIds = (schemaIds: string[] | 'any') =>
    schemaIds === 'any' ? 'any' : schemaIds.map(symId => idMap.get(symId) ?? symId);
  const relationSchemas: RelationSchemaDbCreate[] = (template.relationSchemas ?? []).map(
    relationSchema => ({
      id: relationSchemaIdMap.get(relationSchema.symId)!,
      workspace: workspaceId,
      name: relationSchema.name,
      category: relationSchema.category,
      description: relationSchema.description,
      in_schema_ids: resolveEndpointSchemaIds(relationSchema.inSymSchemaIds),
      out_schema_ids: resolveEndpointSchemaIds(relationSchema.outSymSchemaIds),
      in_label: relationSchema.inLabel,
      out_label: relationSchema.outLabel,
      fields: relationSchema.fields.map(
        field =>
          ({
            id: field.id,
            name: field.name,
            type: field.type,
            enumId: enumIdMap.get(field.enumId) ?? field.enumId,
            requirementLevel: field.requirementLevel
          }) as RelationField
      ),
      groups: [],
      shared_field_group_links: [],
      color: relationSchema.color,
      icon: relationSchema.icon,
      relation_approval_policy: 'disabled',
      created_at: now,
      updated_at: now
    })
  );

  const enums: WorkspaceEnumDbCreate[] = template.enums.map(enumeration => ({
    id: enumIdMap.get(enumeration.id)!,
    workspace: workspaceId,
    name: enumeration.name,
    options: enumeration.options,
    sort_order: template.enums.indexOf(enumeration),
    created_at: now,
    updated_at: now
  }));

  const documentTypes: DocumentTypeDbCreate[] = template.documentTypes.map(documentType => ({
    id: documentTypeIdMap.get(documentType.id)!,
    workspace: workspaceId,
    name: documentType.name,
    description: documentType.description,
    fields: documentType.fields,
    color: documentType.color,
    icon: documentType.icon,
    created_at: now,
    updated_at: now
  }));

  const documentTemplates: DocumentTemplateDbCreate[] = template.documentTemplates.map(
    documentTemplate => ({
      id: randomUUID(),
      workspace: workspaceId,
      project_id: null,
      name: documentTemplate.name,
      body: documentTemplate.body,
      document_type_id: documentTypeIdMap.get(documentTemplate.documentTypeId)!,
      metadata_defaults: { ...documentTemplate.metadataDefaults },
      created_at: now,
      updated_at: now
    })
  );

  const capabilityConfigurations = (template.capabilityConfigurations ?? []).map(configuration => {
    const bindings = Object.fromEntries(
      Object.entries(configuration.bindings).map(([bindingId, binding]) => [
        bindingId,
        {
          ...binding,
          target: {
            kind: binding.target.kind,
            id: resolveCapabilityTargetId(binding.target) ?? binding.target.symId
          }
        }
      ])
    ) as WorkspaceCapabilityBindings;
    return { type: configuration.type, bindings };
  });

  return {
    schemas,
    enums,
    fieldGroups,
    relationSchemas,
    documentTypes,
    documentTemplates,
    dashboardWidgets: resolveTemplateDashboardWidgets(template.dashboardWidgets ?? [], idMap),
    capabilityConfigurations,
    dashboardGroups:
      template.dashboardWidgets && template.dashboardWidgets.length > 0
        ? [
            {
              name: template.category === 'full' ? 'Overview' : template.name,
              widgets: resolveTemplateDashboardWidgets(template.dashboardWidgets, idMap)
            }
          ]
        : [],
    views: resolveTemplateSavedViews(
      template.views ?? [],
      workspaceId,
      idMap,
      relationSchemaIdMap,
      now
    )
  };
};

export type InstantiatedTemplateComposition = InstantiatedTemplate & {
  selectedTemplates: Array<Pick<SchemaTemplate, 'id' | 'name' | 'category'>>;
};

const uniqueDefinitionName = (
  usedNames: Set<string>,
  name: string,
  templateName: string
): string => {
  const normalized = name.toLocaleLowerCase();
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized);
    return name;
  }

  const qualifiedBase = `${templateName} — ${name}`;
  let qualified = qualifiedBase;
  let suffix = 2;
  while (usedNames.has(qualified.toLocaleLowerCase())) {
    qualified = `${qualifiedBase} (${suffix})`;
    suffix += 1;
  }
  usedNames.add(qualified.toLocaleLowerCase());
  return qualified;
};

/**
 * Instantiates one full template and any number of cross-cutting templates.
 * Definitions from later modules are qualified only when their names collide
 * with an earlier module, keeping the first module's names and references intact.
 */
export const instantiateTemplateComposition = (
  workspaceId: string,
  fullTemplateId: string | undefined,
  crossCuttingTemplateIds: readonly string[] = [],
  now = new Date()
): InstantiatedTemplateComposition => {
  const requested = new Set<string>();
  const selected: SchemaTemplate[] = [];
  const full =
    fullTemplateId && fullTemplateId !== 'blank'
      ? SCHEMA_TEMPLATES.find(template => template.id === fullTemplateId)
      : undefined;
  if (full?.category === 'full') {
    selected.push(full);
    requested.add(full.id);
  } else if (full?.category === 'cross-cutting') {
    // Preserve the legacy API where a cross-cutting template was sent in `template`.
    selected.push(full);
    requested.add(full.id);
  }
  for (const template of SCHEMA_TEMPLATES) {
    if (
      template.category === 'cross-cutting' &&
      crossCuttingTemplateIds.includes(template.id) &&
      !requested.has(template.id)
    ) {
      selected.push(template);
      requested.add(template.id);
    }
  }

  const result: InstantiatedTemplateComposition = {
    schemas: [],
    enums: [],
    fieldGroups: [],
    relationSchemas: [],
    documentTypes: [],
    documentTemplates: [],
    dashboardWidgets: [],
    capabilityConfigurations: [],
    dashboardGroups: [],
    views: [],
    selectedTemplates: selected.map(({ id, name, category }) => ({ id, name, category }))
  };
  const usedNames = new Map<string, Set<string>>();
  const namesFor = (kind: string) => {
    const names = usedNames.get(kind) ?? new Set<string>();
    usedNames.set(kind, names);
    return names;
  };
  const usedPrefixes = new Set<string>();
  const documentTypeByName = new Map<string, string>();

  for (const template of selected) {
    const module = instantiateTemplateDefinitions(workspaceId, template.id, now);
    for (const enumeration of module.enums) {
      result.enums.push({
        ...enumeration,
        name: uniqueDefinitionName(namesFor('enum'), enumeration.name, template.name)
      });
    }
    for (const fieldGroup of module.fieldGroups) {
      result.fieldGroups.push({
        ...fieldGroup,
        name: uniqueDefinitionName(namesFor('fieldGroup'), fieldGroup.name, template.name)
      });
    }
    for (const schema of module.schemas) {
      let keyPrefix = schema.key_prefix;
      let prefixSeed = 0;
      while (usedPrefixes.has(keyPrefix)) {
        prefixSeed += 1;
        keyPrefix = normalizePublicIdPrefix(
          generateTemplateSchemaKeyPrefix(`${workspaceId}:${template.id}:${prefixSeed}`, schema.id)
        );
      }
      usedPrefixes.add(keyPrefix);
      result.schemas.push({
        ...schema,
        name: uniqueDefinitionName(namesFor('schema'), schema.name, template.name),
        key_prefix: keyPrefix
      });
    }
    for (const relationSchema of module.relationSchemas) {
      result.relationSchemas.push({
        ...relationSchema,
        name: uniqueDefinitionName(namesFor('relationSchema'), relationSchema.name, template.name)
      });
    }

    const documentTypeIdMap = new Map<string, string>();
    for (const documentType of module.documentTypes) {
      const existingId = documentTypeByName.get(documentType.name.toLocaleLowerCase());
      if (existingId) {
        documentTypeIdMap.set(documentType.id, existingId);
        continue;
      }
      const name = uniqueDefinitionName(namesFor('documentType'), documentType.name, template.name);
      documentTypeByName.set(documentType.name.toLocaleLowerCase(), documentType.id);
      documentTypeIdMap.set(documentType.id, documentType.id);
      result.documentTypes.push({ ...documentType, name });
    }
    for (const documentTemplate of module.documentTemplates) {
      const documentTypeId = documentTypeIdMap.get(documentTemplate.document_type_id);
      if (!documentTypeId) continue;
      result.documentTemplates.push({
        ...documentTemplate,
        document_type_id: documentTypeId,
        name: uniqueDefinitionName(
          namesFor('documentTemplate'),
          documentTemplate.name,
          template.name
        )
      });
    }
    result.capabilityConfigurations.push(...module.capabilityConfigurations);
    if (module.dashboardWidgets.length > 0) {
      const groupName = template.category === 'full' ? 'Overview' : template.name;
      result.dashboardGroups.push({ name: groupName, widgets: module.dashboardWidgets });
      result.dashboardWidgets.push(...module.dashboardWidgets);
    }
    for (const view of module.views) {
      result.views.push({
        ...view,
        name: uniqueDefinitionName(namesFor('savedView'), view.name, template.name)
      });
    }
  }

  return result;
};

export const instantiateTemplateDocuments = (
  workspaceId: string,
  templateId: string,
  now = new Date()
) => {
  const { documentTypes, documentTemplates } = instantiateTemplateDefinitions(
    workspaceId,
    templateId,
    now
  );
  return { documentTypes, documentTemplates };
};

export const instantiateTemplate = (
  workspaceId: string,
  templateId: string,
  now?: Date
): SchemaDbCreate[] => instantiateTemplateDefinitions(workspaceId, templateId, now).schemas;
