import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_CYAN,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED,
  AR_COLOR_TEAL
} from '@arch-register/api-types/colors';
import { createHash, randomUUID } from 'node:crypto';
import type {
  SchemaDbCreate,
  SharedFieldGroupDbCreate,
  WorkspaceEnumDbCreate
} from '../../db/database';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { SchemaField, ValidationRule } from '@arch-register/api-types/schemaContract';
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
import type { SavedViewDbCreate, CategoryDbCreate } from './db/catalogDatabase';
import { normalizePublicIdPrefix } from '../../utils/publicIds';

export type TemplateDependencyKind =
  | 'schema'
  | 'enum'
  | 'fieldGroup'
  | 'relationSchema'
  | 'documentType';

export type SymbolicDependencyReference = { dependencyId: string };

export type SymbolicReference =
  | string
  | { templateId: string; symId: string }
  | SymbolicDependencyReference;

export type SymbolicTemplateDependency = {
  id: string;
  name: string;
  description: string;
  kind: TemplateDependencyKind;
  minTargets: number;
  maxTargets?: number;
};

export type TemplateDependencyTarget = { templateId: string; symId: string };

export type TemplateDependencyMapping = {
  dependencyId: string;
  targets: readonly TemplateDependencyTarget[];
};

export const templateDependencyKey = (ownerId: string, dependencyId: string) =>
  `${ownerId}:${dependencyId}`;

export type TemplateDefinitionSummary = {
  kind: Exclude<TemplateDefinitionKind, 'documentTemplate'>;
  templateId: string;
  symbolicId: string;
  name: string;
};

export type TemplateDependencyDescriptor = SymbolicTemplateDependency & {
  key: string;
  ownerId: string;
  requiredTemplateIds: string[];
  requiredTemplateCategories: SchemaTemplate['category'][];
  requiredBy: Array<{
    kind: TemplateDependencyKind;
    templateId: string;
    symbolicId: string;
    name: string;
  }>;
};

export type SymbolicField =
  | {
      id: string;
      name: string;
      type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency' | 'principal';
      minCardinality?: number;
      maxCardinality?: number;
      requirementLevel?: 'required' | 'expected' | 'optional';
    }
  | {
      id: string;
      name: string;
      type: 'select';
      enumId: SymbolicReference;
      minCardinality?: number;
      maxCardinality?: number;
      requirementLevel?: 'required' | 'expected' | 'optional' | null;
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
      enumId?: SymbolicReference;
    }
  | {
      id: string;
      name: string;
      predicate?: string;
      type: 'reference';
      symSchemaId: SymbolicReference;
      minCount: number;
      maxCount: number;
    }
  | {
      id: string;
      name: string;
      predicate?: string;
      type: 'containment';
      symSchemaId: SymbolicReference;
      minCount: 0 | 1;
      maxCount: 1;
    }
  | {
      id: string;
      name: string;
      type: 'typedRelation';
      symRelationSchemaId: SymbolicReference;
      direction: 'in' | 'out';
      minCount: number;
      maxCount: number;
      requirementLevel?: 'required' | 'expected' | 'optional' | null;
    };

export type TemplateSchema = {
  symId: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  fields: SymbolicField[];
  sharedFieldGroupIds?: SymbolicReference[];
  validationRules?: ValidationRule[];
};

export type SymbolicEnum = {
  id: string;
  name: string;
  category?: string;
  sharedId?: string;
  options: Array<{
    value: string;
    label: string;
    description?: string | null;
    retired?: boolean;
    restricted?: boolean;
  }>;
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
  documentTypeId: SymbolicReference;
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
  inSymSchemaIds: SymbolicReference[] | 'any';
  outSymSchemaIds: SymbolicReference[] | 'any';
  fields: Array<
    | {
        id: string;
        name: string;
        type: 'select';
        enumId: SymbolicReference;
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
        minCardinality?: number;
        maxCardinality?: number;
      }
    | {
        id: string;
        name: string;
        type: 'date';
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        type: 'text' | 'longtext' | 'boolean';
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        type: 'number';
        min?: number;
        max?: number;
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        type: 'entityRelation';
        predicate?: string;
        schemaId: SymbolicReference;
        minCount: number;
        maxCount: number;
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
  >;
  sharedFieldGroupIds?: SymbolicReference[];
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
  dependencies?: SymbolicTemplateDependency[];
  compositionExtensions?: SymbolicTemplateCompositionExtension[];
};

export type SymbolicCapabilityConfiguration = {
  type: string;
  bindings: Record<string, SymbolicCapabilityBinding>;
};

export type SymbolicCapabilityBinding = {
  target: {
    kind: WorkspaceCapabilityTargetKind;
    symId: SymbolicReference;
  };
  fieldMappings?: Record<string, string>;
};

export type SymbolicFieldGroup = {
  id: string;
  name: string;
  category?: string;
  sharedId?: string;
  description?: string;
  fields: SymbolicField[];
};

export type SymbolicTemplateCompositionExtension = {
  id: string;
  requiredTemplateIds: string[];
  requiredTemplateCategories?: SchemaTemplate['category'][];
  dependencies?: SymbolicTemplateDependency[];
  relationSchemas?: SymbolicRelationSchema[];
  schemaFields?: Array<{
    target: SymbolicReference;
    fields: SymbolicField[];
  }>;
};

export const getTemplateDefinitionSummaries = (
  template: SchemaTemplate
): TemplateDefinitionSummary[] => [
  ...template.schemas.map(schema => ({
    kind: 'schema' as const,
    templateId: template.id,
    symbolicId: schema.symId,
    name: schema.name
  })),
  ...template.enums.map(enumeration => ({
    kind: 'enum' as const,
    templateId: template.id,
    symbolicId: enumeration.id,
    name: enumeration.name
  })),
  ...(template.fieldGroups ?? []).map(fieldGroup => ({
    kind: 'fieldGroup' as const,
    templateId: template.id,
    symbolicId: fieldGroup.id,
    name: fieldGroup.name
  })),
  ...(template.relationSchemas ?? []).map(relationSchema => ({
    kind: 'relationSchema' as const,
    templateId: template.id,
    symbolicId: relationSchema.symId,
    name: relationSchema.name
  })),
  ...template.documentTypes.map(documentType => ({
    kind: 'documentType' as const,
    templateId: template.id,
    symbolicId: documentType.id,
    name: documentType.name
  })),
  ...(template.compositionExtensions ?? []).flatMap(extension =>
    (extension.relationSchemas ?? []).map(relationSchema => ({
      kind: 'relationSchema' as const,
      templateId: `${template.id}:${extension.id}`,
      symbolicId: relationSchema.symId,
      name: relationSchema.name
    }))
  )
];

export const getTemplateDependencyDescriptors = (
  template: SchemaTemplate
): TemplateDependencyDescriptor[] => [
  ...(template.dependencies ?? []).map(dependency => ({
    ...dependency,
    key: templateDependencyKey(template.id, dependency.id),
    ownerId: template.id,
    requiredTemplateIds: [],
    requiredTemplateCategories: [],
    requiredBy: []
  })),
  ...(template.compositionExtensions ?? []).flatMap(extension => {
    const ownerId = `${template.id}:${extension.id}`;
    const requiredBy = [
      ...(extension.relationSchemas ?? []).map(relationSchema => ({
        kind: 'relationSchema' as const,
        templateId: ownerId,
        symbolicId: relationSchema.symId,
        name: relationSchema.name
      }))
    ];
    return (extension.dependencies ?? []).map(dependency => ({
      ...dependency,
      key: templateDependencyKey(ownerId, dependency.id),
      ownerId,
      requiredTemplateIds: [...extension.requiredTemplateIds],
      requiredTemplateCategories: [...(extension.requiredTemplateCategories ?? [])],
      requiredBy
    }));
  })
];

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
  relationSchemaId: SymbolicReference,
  direction: 'in' | 'out'
): SymbolicField => ({
  id,
  name,
  type: 'typedRelation',
  symRelationSchemaId: relationSchemaId,
  direction,
  minCount: 0,
  maxCount: -1,
  requirementLevel: null
});

const enumDefinition = (
  id: string,
  name: string,
  options: SymbolicEnum['options'],
  category: string,
  sharedId?: string
): SymbolicEnum => ({ id, name, category, options, ...(sharedId ? { sharedId } : {}) });

const piiClassificationEnum = enumDefinition(
  'pii-classification',
  'PII Classification',
  [
    { value: 'none', label: 'None', restricted: false },
    { value: 'public', label: 'Public', restricted: false },
    {
      value: 'non-sensitive',
      label: 'Non-Sensitive',
      restricted: false
    },
    { value: 'sensitive', label: 'Sensitive', restricted: true },
    { value: 'highly-sensitive', label: 'Highly Sensitive', restricted: true }
  ],
  'Governance',
  'pii-classification'
);

const contractPurposeEnum = enumDefinition(
  'contract-purpose',
  'Contract Purpose',
  [
    { value: 'license', label: 'License' },
    { value: 'support', label: 'Support' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'hosting', label: 'Hosting' },
    { value: 'professional-services', label: 'Professional Services' },
    { value: 'other', label: 'Other' }
  ],
  'Vendor'
);

const communicationProtocolEnum = enumDefinition(
  'communication-protocol',
  'Communication Protocol',
  [
    { value: 'https-rest', label: 'HTTPS / REST' },
    { value: 'grpc', label: 'gRPC' },
    { value: 'kafka', label: 'Kafka' },
    { value: 'file-transfer', label: 'Batch File Transfer' },
    { value: 'database-replication', label: 'Database Replication' }
  ],
  'Architecture',
  'communication-protocol'
);

const piiClassificationFieldGroup: SymbolicFieldGroup = {
  id: 'pii-classification',
  name: 'PII Classification',
  category: 'Governance',
  sharedId: 'pii-classification',
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
  enumDefinition(
    'api-type',
    'API Type',
    [
      { value: 'openapi', label: 'OpenAPI' },
      { value: 'grpc', label: 'gRPC' },
      { value: 'graphql', label: 'GraphQL' },
      { value: 'asyncapi', label: 'AsyncAPI' }
    ],
    'Architecture'
  ),
  enumDefinition(
    'component-kind',
    'Component Kind',
    [
      { value: 'service', label: 'Service' },
      { value: 'library', label: 'Library' },
      { value: 'website', label: 'Website' },
      { value: 'documentation', label: 'Documentation' }
    ],
    'Architecture'
  ),
  enumDefinition(
    'resource-kind',
    'Resource Kind',
    [
      { value: 'database', label: 'Database' },
      { value: 'cache', label: 'Cache' },
      { value: 'queue', label: 'Queue' },
      { value: 'blob-storage', label: 'Blob Storage' }
    ],
    'Architecture'
  )
];

const itilEnums = [
  enumDefinition(
    'application-tier',
    'Application Tier',
    [
      { value: 'strategic', label: 'Strategic' },
      { value: 'tactical', label: 'Tactical' },
      { value: 'commodity', label: 'Commodity' }
    ],
    'Architecture'
  ),
  enumDefinition(
    'host-type',
    'Host Type',
    [
      { value: 'physical', label: 'Physical' },
      { value: 'virtual', label: 'Virtual' },
      { value: 'container', label: 'Container' }
    ],
    'Technology'
  ),
  enumDefinition(
    'environment',
    'Environment',
    [
      { value: 'development', label: 'Development' },
      { value: 'test', label: 'Test' },
      { value: 'staging', label: 'Staging' },
      { value: 'production', label: 'Production' }
    ],
    'Technology'
  )
];

const dddEnums = [
  enumDefinition(
    'service-kind',
    'Service Kind',
    [
      { value: 'domain', label: 'Domain' },
      { value: 'application', label: 'Application' },
      { value: 'infrastructure', label: 'Infrastructure' }
    ],
    'Architecture'
  ),
  enumDefinition(
    'event-type',
    'Event Type',
    [
      { value: 'command', label: 'Command' },
      { value: 'event', label: 'Event' },
      { value: 'query', label: 'Query' }
    ],
    'Architecture'
  )
];

const teamTopologiesEnums = [
  enumDefinition(
    'team-type',
    'Team Type',
    [
      { value: 'stream-aligned', label: 'Stream-aligned' },
      { value: 'platform', label: 'Platform' },
      { value: 'enabling', label: 'Enabling' },
      { value: 'complicated-subsystem', label: 'Complicated Subsystem' }
    ],
    'Organization'
  ),
  enumDefinition(
    'interaction-mode',
    'Interaction Mode',
    [
      { value: 'collaboration', label: 'Collaboration' },
      { value: 'x-as-a-service', label: 'X-as-a-Service' },
      { value: 'facilitating', label: 'Facilitating' }
    ],
    'Organization'
  )
];

const dataMeshEnums = [
  enumDefinition(
    'data-product-type',
    'Data Product Type',
    [
      { value: 'source-aligned', label: 'Source-aligned' },
      { value: 'aggregate', label: 'Aggregate' },
      { value: 'consumer-aligned', label: 'Consumer-aligned' }
    ],
    'Data'
  ),
  enumDefinition(
    'dataset-format',
    'Dataset Format',
    [
      { value: 'csv', label: 'CSV' },
      { value: 'json', label: 'JSON' },
      { value: 'avro', label: 'Avro' },
      { value: 'parquet', label: 'Parquet' },
      { value: 'relational', label: 'Relational' }
    ],
    'Data'
  )
];

const archimateEnums = [
  enumDefinition(
    'layer',
    'Layer',
    [
      { value: 'business', label: 'Business' },
      { value: 'application', label: 'Application' },
      { value: 'technology', label: 'Technology' }
    ],
    'Architecture'
  ),
  enumDefinition(
    'technology-kind',
    'Technology Kind',
    [
      { value: 'device', label: 'Device' },
      { value: 'system-software', label: 'System Software' },
      { value: 'artifact', label: 'Artifact' }
    ],
    'Architecture'
  )
];

const technologyEnums = [
  enumDefinition(
    'technology-category',
    'Technology Category',
    [
      { value: 'language', label: 'Language' },
      { value: 'framework', label: 'Framework' },
      { value: 'database', label: 'Database' },
      { value: 'operating-system', label: 'Operating System' },
      { value: 'runtime', label: 'Runtime' },
      { value: 'library', label: 'Library' }
    ],
    'Technology'
  ),
  enumDefinition(
    'technology-radar-status',
    'Technology Radar Status',
    [
      { value: 'adopt', label: 'Adopt' },
      { value: 'trial', label: 'Trial' },
      { value: 'assess', label: 'Assess' },
      { value: 'hold', label: 'Hold' }
    ],
    'Technology'
  )
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

const strategyStatusEnum = enumDefinition(
  'strategy-status',
  'Strategy Status',
  [
    { value: 'draft', label: 'Draft' },
    { value: 'active', label: 'Active' },
    { value: 'achieved', label: 'Achieved' },
    { value: 'abandoned', label: 'Abandoned' }
  ],
  'Strategy'
);

const strategySchemas: TemplateSchema[] = [
  {
    symId: 'business_capability',
    name: 'Business Capability',
    description: 'A high-level ability the organisation needs to execute its strategy.',
    category: 'Strategy',
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
      { id: 'target_date', name: 'Target Date', type: 'date' },
      {
        id: 'capability_level',
        name: 'Capability Level',
        type: 'derived',
        expression:
          "entity.parent == null ? 'L1' : 'L' + ((entity.parent.capability_level |> replace('L', '') |> toNumber) + 1)",
        resultType: 'text'
      },
      {
        id: 'supporting_objectives',
        name: 'Supported by Objectives',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-supports-business-capability',
        direction: 'out',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'supported_entities',
        name: 'Supports Entities',
        type: 'typedRelation',
        symRelationSchemaId: 'business-capability-supports-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      }
    ]
  },
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
        id: 'supported_capabilities',
        name: 'Supports',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-supports-business-capability',
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
    symId: 'objective-supports-business-capability',
    name: 'Objective Supports Business Capability',
    description: 'Associates an Objective with a Business Capability that supports or enables it.',
    category: 'Strategy',
    inLabel: 'Supports Business Capabilities',
    outLabel: 'Supported by Objectives',
    inSymSchemaIds: ['objective'],
    outSymSchemaIds: ['business_capability'],
    fields: [],
    color: AR_COLOR_PURPLE,
    icon: 'target'
  },
  {
    symId: 'business-capability-supports-entity',
    name: 'Business Capability Supports Entity',
    description: 'Associates a Business Capability with an entity that helps realise it.',
    category: 'Strategy',
    inLabel: 'Supports Entities',
    outLabel: 'Supported by Business Capabilities',
    inSymSchemaIds: ['business_capability'],
    outSymSchemaIds: 'any',
    fields: [],
    color: AR_COLOR_PURPLE,
    icon: 'layers'
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
  enumDefinition(
    'classification',
    'Classification',
    [
      { value: 'public', label: 'Public' },
      { value: 'internal', label: 'Internal' },
      { value: 'confidential', label: 'Confidential' },
      { value: 'restricted', label: 'Restricted' }
    ],
    'Security'
  ),
  enumDefinition(
    'asset-type',
    'Asset Type',
    [
      { value: 'data', label: 'Data' },
      { value: 'service', label: 'Service' },
      { value: 'infrastructure', label: 'Infrastructure' },
      { value: 'credential', label: 'Credential' }
    ],
    'Security'
  ),
  enumDefinition(
    'stride-category',
    'STRIDE Category',
    [
      { value: 'spoofing', label: 'Spoofing' },
      { value: 'tampering', label: 'Tampering' },
      { value: 'repudiation', label: 'Repudiation' },
      { value: 'information-disclosure', label: 'Information Disclosure' },
      { value: 'denial-of-service', label: 'Denial of Service' },
      { value: 'elevation-of-privilege', label: 'Elevation of Privilege' }
    ],
    'Security'
  ),
  enumDefinition(
    'control-type',
    'Control Type',
    [
      { value: 'preventive', label: 'Preventive' },
      { value: 'detective', label: 'Detective' },
      { value: 'corrective', label: 'Corrective' }
    ],
    'Security'
  ),
  enumDefinition(
    'likelihood',
    'Likelihood',
    [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ],
    'Security'
  ),
  enumDefinition(
    'impact',
    'Impact',
    [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ],
    'Security'
  )
];

const riskComplianceEnums = [
  enumDefinition(
    'risk-status',
    'Risk Status',
    [
      { value: 'open', label: 'Open' },
      { value: 'mitigating', label: 'Mitigating' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'closed', label: 'Closed' }
    ],
    'Governance'
  ),
  enumDefinition(
    'risk-mitigation-effectiveness',
    'Mitigation Effectiveness',
    [
      { value: 'none', label: 'None' },
      { value: 'partial', label: 'Partial' },
      { value: 'substantial', label: 'Substantial' },
      { value: 'full', label: 'Full' }
    ],
    'Governance'
  ),
  enumDefinition(
    'rc-control-type',
    'Control Type',
    [
      { value: 'preventive', label: 'Preventive' },
      { value: 'detective', label: 'Detective' },
      { value: 'corrective', label: 'Corrective' },
      { value: 'compensating', label: 'Compensating' }
    ],
    'Governance'
  ),
  enumDefinition(
    'control-effectiveness',
    'Control Effectiveness',
    [
      { value: 'effective', label: 'Effective' },
      { value: 'partially-effective', label: 'Partially Effective' },
      { value: 'ineffective', label: 'Ineffective' },
      { value: 'not-tested', label: 'Not Tested' }
    ],
    'Governance'
  ),
  enumDefinition(
    'framework-kind',
    'Framework Kind',
    [
      { value: 'soc2', label: 'SOC 2' },
      { value: 'iso27001', label: 'ISO 27001' },
      { value: 'nist', label: 'NIST' },
      { value: 'custom', label: 'Custom' }
    ],
    'Governance'
  ),
  enumDefinition(
    'requirement-status',
    'Requirement Status',
    [
      { value: 'not-started', label: 'Not Started' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'met', label: 'Met' },
      { value: 'not-applicable', label: 'Not Applicable' }
    ],
    'Governance'
  )
];

const informationGovernanceEnums = [
  enumDefinition(
    'data-flow-direction',
    'Data Flow Direction',
    [
      { value: 'one-way', label: 'One-way' },
      { value: 'bidirectional', label: 'Bidirectional' }
    ],
    'Data'
  ),
  enumDefinition(
    'regulatory-tags',
    'Regulatory Tags',
    [
      { value: 'gdpr', label: 'GDPR' },
      { value: 'ccpa', label: 'CCPA' },
      { value: 'hipaa', label: 'HIPAA' },
      { value: 'pci-dss', label: 'PCI-DSS' }
    ],
    'Data'
  ),
  enumDefinition(
    'processing-purposes',
    'Processing Purposes',
    [
      { value: 'marketing', label: 'Marketing' },
      { value: 'analytics', label: 'Analytics' },
      { value: 'fraud-prevention', label: 'Fraud Prevention' },
      { value: 'customer-support', label: 'Customer Support' }
    ],
    'Data'
  ),
  enumDefinition(
    'residency-regions',
    'Residency Regions',
    [
      { value: 'eu', label: 'EU' },
      { value: 'us', label: 'US' },
      { value: 'uk', label: 'UK' },
      { value: 'apac', label: 'APAC' }
    ],
    'Data'
  ),
  enumDefinition(
    'retention-time-unit',
    'Retention Time Unit',
    [
      { value: 'days', label: 'Days' },
      { value: 'months', label: 'Months' },
      { value: 'years', label: 'Years' }
    ],
    'Governance'
  ),
  communicationProtocolEnum
];

const retentionPolicySchema: TemplateSchema = {
  symId: 'retention-policy',
  name: 'Retention Policy',
  description:
    'A named retention policy defining how long data governed by it may be retained, in a given time unit.',
  category: 'Governance',
  color: AR_COLOR_RED,
  icon: 'clock',
  fields: [
    { id: 'duration', name: 'Duration', type: 'number', min: 1 },
    { id: 'time_unit', name: 'Time Unit', type: 'select', enumId: 'retention-time-unit' },
    {
      id: 'governed_entities',
      name: 'Governed Entities',
      type: 'typedRelation',
      symRelationSchemaId: 'retention-assignment',
      direction: 'out',
      minCount: 0,
      maxCount: -1
    }
  ]
};

const retentionAssignmentRelationSchema: SymbolicRelationSchema = {
  symId: 'retention-assignment',
  name: 'Subject to Retention Policy',
  description:
    'Assigns a retention policy to a governed entity, recording the date it became subject to it.',
  category: 'Governance',
  inLabel: 'Subject to Retention Policy',
  outLabel: 'Governs',
  inSymSchemaIds: 'any',
  outSymSchemaIds: ['retention-policy'],
  fields: [
    { id: 'activated_from', name: 'Activated From', type: 'date', requirementLevel: 'required' }
  ],
  color: AR_COLOR_RED,
  icon: 'clock'
};

const informationAssetFieldGroup: SymbolicFieldGroup = {
  id: 'information-asset-stewardship',
  name: 'Information Asset Stewardship',
  category: 'Data',
  description:
    'Accountable people and handling metadata for a governed information asset: steward, ' +
    'custodian, review date, regulatory tags, processing purposes, and permitted residency regions.',
  fields: [
    { id: 'steward', name: 'Steward', type: 'principal', requirementLevel: 'expected' },
    { id: 'custodian', name: 'Custodian', type: 'principal', requirementLevel: 'expected' },
    { id: 'review_date', name: 'Review Date', type: 'date', requirementLevel: 'expected' },
    {
      id: 'regulatory_tags',
      name: 'Regulatory Tags',
      type: 'select',
      enumId: 'regulatory-tags',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'processing_purposes',
      name: 'Processing Purposes',
      type: 'select',
      enumId: 'processing-purposes',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'permitted_residency_regions',
      name: 'Permitted Residency Regions',
      type: 'select',
      enumId: 'residency-regions',
      minCardinality: 0,
      maxCardinality: -1
    }
  ]
};

// Mirrors the governance metadata on the bundled demo workspace's Data Flow relation. The group
// is attached through the information-governance composition extension below, so the same fields
// and vocabularies are available whenever the default and information-governance templates are
// composed together.
const dataFlowGovernanceFieldGroup: SymbolicFieldGroup = {
  id: 'data-flow-governance',
  name: 'Data Flow Governance',
  category: 'Data',
  description:
    'Transfer-specific handling metadata for a governed data flow: regulatory tags, processing ' +
    'purposes, and source/destination residency regions.',
  fields: [
    {
      id: 'regulatory_tags',
      name: 'Regulatory Tags',
      type: 'select',
      enumId: 'regulatory-tags',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'processing_purposes',
      name: 'Processing Purposes',
      type: 'select',
      enumId: 'processing-purposes',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'source_residency_region',
      name: 'Source Residency Region',
      type: 'select',
      enumId: 'residency-regions',
      requirementLevel: 'optional'
    },
    {
      id: 'destination_residency_region',
      name: 'Destination Residency Region',
      type: 'select',
      enumId: 'residency-regions',
      requirementLevel: 'optional'
    },
    {
      id: 'cross_boundary',
      name: 'Cross-Boundary Transfer',
      type: 'derived',
      // Mirrors dataFlowResidency.ts's computeCrossBoundary. A missing region is never treated as
      // compliant — it is reported as 'incomplete', distinct from 'same-region'.
      expression:
        "relation.source_residency_region == null || relation.source_residency_region == '' || relation.destination_residency_region == null || relation.destination_residency_region == '' ? 'incomplete' : relation.source_residency_region == relation.destination_residency_region ? 'same-region' : 'cross-boundary'",
      resultType: 'text'
    },
    {
      id: 'residency_invalid',
      name: 'Residency-Invalid Transfer',
      type: 'derived',
      // Mirrors dataFlowResidency.ts's computeResidencyInvalid. 'not-applicable' when no carried
      // Data Entity declares any permitted regions; 'incomplete' when the destination region
      // itself is missing; 'invalid' when the destination region is absent from any carried
      // entity's permitted-regions list.
      expression:
        "relation.data_entities.filter(.permitted_residency_regions.length > 0).length == 0 ? 'not-applicable' : (relation.destination_residency_region == null || relation.destination_residency_region == '') ? 'incomplete' : relation.data_entities.filter(.permitted_residency_regions.length > 0).some(.permitted_residency_regions.filter(. == relation.destination_residency_region).length == 0) ? 'invalid' : 'valid'",
      resultType: 'text'
    }
  ]
};

const dataEntitySchema: TemplateSchema = {
  symId: 'data-entity',
  name: 'Data Entity',
  description:
    'A named category of data (e.g. a business object or record type) that can be governed as ' +
    'an information asset, with classification, handling metadata, and accountable stewardship.',
  category: 'Data',
  color: AR_COLOR_CYAN,
  icon: 'tag',
  fields: [
    {
      id: 'classification',
      name: 'Classification',
      type: 'select',
      enumId: 'pii-classification',
      requirementLevel: 'optional'
    }
  ],
  sharedFieldGroupIds: ['information-asset-stewardship']
};

const dataFlowExtensionTemplateId = 'information-governance:data-flow';

const dataFlowRelationSchema: SymbolicRelationSchema = {
  symId: 'data-flow',
  name: 'Data Flow',
  description:
    'Models data moving from one System to another: its direction, the sensitivity of the data carried, and the protocol used to move it.',
  category: 'Data',
  inLabel: 'Sends data to System',
  outLabel: 'Receives data from System',
  inSymSchemaIds: [{ dependencyId: 'system' }],
  outSymSchemaIds: [{ dependencyId: 'system' }],
  fields: [
    {
      id: 'direction',
      name: 'Direction',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'data-flow-direction' },
      requirementLevel: 'required'
    },
    {
      id: 'data_classification',
      name: 'Data Classification',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'pii-classification' },
      requirementLevel: 'required'
    },
    {
      id: 'protocol',
      name: 'Protocol',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'communication-protocol' },
      requirementLevel: 'optional'
    },
    {
      id: 'data_entities',
      name: 'Data',
      type: 'entityRelation',
      predicate: 'carries',
      schemaId: { templateId: 'information-governance', symId: 'data-entity' },
      minCount: 0,
      maxCount: -1,
      requirementLevel: 'optional'
    }
  ],
  sharedFieldGroupIds: [{ templateId: 'information-governance', symId: 'data-flow-governance' }],
  color: AR_COLOR_TEAL,
  icon: 'network'
};

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
    id: 'information-governance',
    category: 'cross-cutting',
    name: 'Information Governance',
    description:
      'Reusable option sets for information governance metadata, plus retention policies, policy ' +
      'assignment, and a governed Data Entity schema for information-asset stewardship.',
    schemas: [retentionPolicySchema, dataEntitySchema],
    enums: [...informationGovernanceEnums, piiClassificationEnum],
    fieldGroups: [informationAssetFieldGroup, dataFlowGovernanceFieldGroup],
    relationSchemas: [retentionAssignmentRelationSchema],
    documentTypes: [],
    documentTemplates: [],
    capabilityConfigurations: [
      {
        type: 'retention',
        bindings: {
          policy: { target: { kind: 'entity_schema', symId: 'retention-policy' } },
          assignment: { target: { kind: 'relation_schema', symId: 'retention-assignment' } }
        }
      }
    ],
    compositionExtensions: [
      {
        id: 'data-flow',
        requiredTemplateIds: [],
        requiredTemplateCategories: ['full'],
        dependencies: [
          {
            id: 'system',
            name: 'System schema',
            description: 'The schema or schemas that represent systems in this workspace.',
            kind: 'schema',
            minTargets: 1
          }
        ],
        relationSchemas: [dataFlowRelationSchema],
        schemaFields: [
          {
            target: { dependencyId: 'system' },
            fields: [
              {
                id: 'data_flows_out',
                name: 'Sends data to',
                type: 'typedRelation',
                symRelationSchemaId: {
                  templateId: dataFlowExtensionTemplateId,
                  symId: 'data-flow'
                },
                direction: 'out',
                minCount: 0,
                maxCount: -1,
                requirementLevel: null
              },
              {
                id: 'data_flows_in',
                name: 'Receives data from',
                type: 'typedRelation',
                symRelationSchemaId: {
                  templateId: dataFlowExtensionTemplateId,
                  symId: 'data-flow'
                },
                direction: 'in',
                minCount: 0,
                maxCount: -1,
                requirementLevel: null
              }
            ]
          }
        ]
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
            direction: 'in',
            minCount: 0,
            maxCount: -1,
            requirementLevel: null
          },
          {
            id: 'budget',
            name: 'Budget',
            type: 'derived',
            expression:
              'entity.contracts.map(.allocation * .entity.annual_cost.amount / 100) |> sum',
            resultType: 'number'
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
            name: 'System',
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
            id: 'protocols',
            name: 'Protocols',
            type: 'select',
            enumId: 'communication-protocol',
            requirementLevel: 'required',
            minCardinality: 1,
            maxCardinality: -1
          },
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
            id: 'allocated',
            name: 'Allocated',
            type: 'derived',
            expression: 'entity.system.map(.allocation) |> sum',
            resultType: 'number'
          },
          {
            id: 'system',
            name: 'Used by',
            type: 'typedRelation',
            symRelationSchemaId: 'system-contract',
            direction: 'out',
            minCount: 0,
            maxCount: -1,
            requirementLevel: null
          }
        ],
        validationRules: [
          {
            id: 'allocated-at-most-100',
            name: 'Allocated cannot exceed 100%',
            expression: 'entity.allocated <= 100',
            message: 'A Contract cannot be allocated to more than 100% of its capacity.',
            severity: 'error',
            fieldId: 'allocated',
            active: true
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
    enums: [
      backstageEnums[0]!,
      communicationProtocolEnum,
      piiClassificationEnum,
      contractPurposeEnum,
      ...technologyEnums
    ],
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
          },
          {
            id: 'allocation',
            name: 'Allocation',
            type: 'number',
            min: 0,
            max: 100,
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
            id: 'affected_entities',
            name: 'Affects',
            type: 'typedRelation',
            symRelationSchemaId: 'risk-affects',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          },
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
        fields: [
          {
            id: 'effectiveness',
            name: 'Effectiveness',
            type: 'select',
            enumId: 'risk-mitigation-effectiveness',
            requirementLevel: 'required'
          },
          {
            id: 'coverage',
            name: 'Coverage',
            type: 'number',
            min: 0,
            max: 100,
            requirementLevel: 'required'
          },
          { id: 'reviewed_on', name: 'Reviewed On', type: 'date' }
        ],
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
        fields: [
          {
            id: 'status',
            name: 'Status',
            type: 'select',
            enumId: 'requirement-status',
            requirementLevel: 'required'
          },
          { id: 'evidence', name: 'Evidence', type: 'text' },
          { id: 'verified_on', name: 'Verified On', type: 'date' }
        ],
        color: AR_COLOR_GREEN,
        icon: 'check-circle'
      },
      {
        symId: 'risk-affects',
        name: 'Risk Affects',
        description: 'Associates a Risk with an architecture entity affected by it.',
        category: 'Governance',
        inLabel: 'Affects Entities',
        outLabel: 'Affected by Risk',
        inSymSchemaIds: ['risk'],
        outSymSchemaIds: 'any',
        fields: [],
        color: AR_COLOR_RED,
        icon: 'alert-triangle'
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
      'Strategic objectives, outcomes, initiatives, measures, and Business Capabilities with nested hierarchy.',
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
          measure: { target: { kind: 'entity_schema', symId: 'measure' } },
          business_capability: {
            target: { kind: 'entity_schema', symId: 'business_capability' }
          }
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
      },
      {
        id: 'strategy-traceability',
        name: 'Strategy Traceability',
        viewMode: 'traceability',
        filters: {
          schemaId: 'objective',
          root: { kind: 'and', children: [] }
        },
        config: {
          traceability: {
            paths: [
              {
                id: 'supporting-capabilities',
                label: 'Supporting capabilities',
                path: [
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'objective-supports-business-capability',
                    direction: 'in'
                  }
                ],
                targetSchemaIds: ['business_capability']
              },
              {
                id: 'supported-entities',
                label: 'Supported entities',
                path: [
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'objective-supports-business-capability',
                    direction: 'in'
                  },
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'business-capability-supports-entity',
                    direction: 'in'
                  }
                ],
                targetSchemaIds: 'any'
              },
              {
                id: 'affected-entities',
                label: 'Affected entities',
                path: [
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'objective-affects-entity',
                    direction: 'in'
                  }
                ],
                targetSchemaIds: 'any'
              }
            ],
            deliverySources: ['projects', 'milestones', 'changeCases', 'assessments'],
            showOrphanEntities: true,
            showOrphanProjects: true
          }
        }
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
    case 'traceability': {
      const resolved: Record<string, unknown> = { ...config };
      if (Array.isArray(config.paths)) {
        resolved.paths = (config.paths as Array<Record<string, unknown>>).map(path => ({
          ...path,
          ...(Array.isArray(path.path) && {
            path: (path.path as PathStep[]).map(step =>
              resolvePathStepSchemaIds(step, idMap, relationSchemaIdMap)
            )
          }),
          ...(Array.isArray(path.targetSchemaIds) && {
            targetSchemaIds: (path.targetSchemaIds as string[]).map(
              symId => idMap.get(symId) ?? symId
            )
          })
        }));
      }
      return resolved;
    }
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
  for (const mode of ['radar', 'matrix', 'map', 'explore', 'graph', 'traceability']) {
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
  /** Categories referenced by schemas/enums/fieldGroups/relationSchemas below, keyed by a
   * deterministic (workspace, name) id so the same category name always resolves to the same
   * row whichever template fragment first introduces it — must be persisted before those. */
  categories: CategoryDbCreate[];
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

export type TemplateDefinitionKind =
  | 'schema'
  | 'enum'
  | 'fieldGroup'
  | 'relationSchema'
  | 'documentType'
  | 'documentTemplate';

export type TemplateInstantiationOptions = {
  idFactory?: (
    kind: TemplateDefinitionKind,
    templateId: string,
    symbolicId: string,
    sharedId?: string
  ) => string;
  schemaKeyPrefixFactory?: (workspaceId: string, templateId: string, symbolicId: string) => string;
  dependencyMappings?: readonly TemplateDependencyMapping[];
};

export type InstantiatedTemplateComposition = InstantiatedTemplate & {
  selectedTemplates: Array<Pick<SchemaTemplate, 'id' | 'name' | 'category'>>;
};

const emptyInstantiatedTemplate = (): InstantiatedTemplate => ({
  categories: [],
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
});

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

type TemplateFragment = {
  ownerId: string;
  template: SchemaTemplate;
  schemaFields: Array<{ target: SymbolicReference; fields: SymbolicField[] }>;
};

type MaterializedTemplateModule = InstantiatedTemplate & {
  ownerId: string;
  template: SchemaTemplate;
};

type SymbolicIdMaps = Map<TemplateDefinitionKind, Map<string, Map<string, string>>>;

const definitionKey = (kind: TemplateDefinitionKind, ownerId: string, symbolicId: string) =>
  `${kind}:${ownerId}:${symbolicId}`;

const extensionTemplate = (
  parent: SchemaTemplate,
  extension: SymbolicTemplateCompositionExtension
): SchemaTemplate => ({
  id: `${parent.id}:${extension.id}`,
  category: parent.category,
  name: `${parent.name} — ${extension.id}`,
  description: '',
  schemas: [],
  enums: [],
  fieldGroups: [],
  relationSchemas: extension.relationSchemas ?? [],
  documentTypes: [],
  documentTemplates: [],
  dependencies: extension.dependencies
});

const createTemplateFragments = (
  selected: readonly SchemaTemplate[],
  includeExtensions: boolean
): TemplateFragment[] => {
  const selectedIds = new Set(selected.map(template => template.id));
  const fragments: TemplateFragment[] = selected.map(template => ({
    ownerId: template.id,
    template,
    schemaFields: []
  }));

  if (!includeExtensions) return fragments;

  for (const parent of selected) {
    for (const extension of parent.compositionExtensions ?? []) {
      const requiredIdsPresent = extension.requiredTemplateIds.every(templateId =>
        selectedIds.has(templateId)
      );
      const requiredCategoriesPresent = (extension.requiredTemplateCategories ?? []).every(
        category => selected.some(template => template.category === category)
      );
      if (!requiredIdsPresent || !requiredCategoriesPresent) {
        continue;
      }
      fragments.push({
        ownerId: `${parent.id}:${extension.id}`,
        template: extensionTemplate(parent, extension),
        schemaFields: extension.schemaFields ?? []
      });
    }
  }
  return fragments;
};

// Deterministic per-(workspace, name) id: template category names ("Architecture", "Governance",
// ...) must resolve to the same workspace_category row wherever they're introduced, across
// independently-materialized template fragments, without a cross-fragment remapping pass.
const deterministicCategoryId = (workspaceId: string, name: string): string => {
  const hash = createHash('sha256')
    .update(`${workspaceId}:category:${name.toLowerCase()}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
};

const materializeTemplateFragments = (
  workspaceId: string,
  fragments: readonly TemplateFragment[],
  now: Date,
  options: TemplateInstantiationOptions = {}
): MaterializedTemplateModule[] => {
  const ids: SymbolicIdMaps = new Map();
  const sharedIds = new Map<string, string>();

  const ownerMap = (kind: TemplateDefinitionKind, ownerId: string) => {
    const byOwner = ids.get(kind) ?? new Map<string, Map<string, string>>();
    ids.set(kind, byOwner);
    const map = byOwner.get(ownerId) ?? new Map<string, string>();
    byOwner.set(ownerId, map);
    return map;
  };

  const allocateId = (
    kind: TemplateDefinitionKind,
    ownerId: string,
    symbolicId: string,
    sharedId?: string
  ) => {
    const local = ownerMap(kind, ownerId);
    const existing = local.get(symbolicId);
    if (existing) return existing;

    const sharedKey = sharedId ? `${kind}:${sharedId}` : undefined;
    const shared = sharedKey ? sharedIds.get(sharedKey) : undefined;
    const id = shared ?? options.idFactory?.(kind, ownerId, symbolicId, sharedId) ?? randomUUID();
    local.set(symbolicId, id);
    if (sharedKey) sharedIds.set(sharedKey, id);
    return id;
  };

  const schemaSources = new Map<string, TemplateSchema>();
  for (const fragment of fragments) {
    for (const schema of fragment.template.schemas) {
      schemaSources.set(definitionKey('schema', fragment.ownerId, schema.symId), {
        ...schema,
        fields: [...schema.fields]
      });
      allocateId('schema', fragment.ownerId, schema.symId);
    }
    for (const enumeration of fragment.template.enums) {
      allocateId('enum', fragment.ownerId, enumeration.id, enumeration.sharedId);
    }
    for (const fieldGroup of fragment.template.fieldGroups ?? []) {
      allocateId('fieldGroup', fragment.ownerId, fieldGroup.id, fieldGroup.sharedId);
    }
    for (const relationSchema of fragment.template.relationSchemas ?? []) {
      allocateId('relationSchema', fragment.ownerId, relationSchema.symId);
    }
    for (const documentType of fragment.template.documentTypes) {
      allocateId('documentType', fragment.ownerId, documentType.id);
    }
    for (const documentTemplate of fragment.template.documentTemplates) {
      allocateId('documentTemplate', fragment.ownerId, documentTemplate.id);
    }
  }

  const dependencySources = new Map<string, SymbolicTemplateDependency>();
  for (const fragment of fragments) {
    for (const dependency of fragment.template.dependencies ?? []) {
      const key = templateDependencyKey(fragment.ownerId, dependency.id);
      if (dependencySources.has(key)) {
        throw new Error(`Template dependency '${key}' is declared more than once`);
      }
      dependencySources.set(key, dependency);
    }
  }

  const dependencyMappings = new Map<string, readonly TemplateDependencyTarget[]>();
  for (const mapping of options.dependencyMappings ?? []) {
    if (dependencyMappings.has(mapping.dependencyId)) {
      throw new Error(`Template dependency '${mapping.dependencyId}' has multiple mappings`);
    }
    dependencyMappings.set(mapping.dependencyId, mapping.targets);
  }
  for (const dependencyId of dependencyMappings.keys()) {
    if (!dependencySources.has(dependencyId)) {
      throw new Error(`Template dependency '${dependencyId}' is not active in this composition`);
    }
  }

  const normalizeReference = (
    ownerId: string,
    reference: SymbolicReference
  ): { templateId: string; symId: string } => {
    if (typeof reference === 'string') return { templateId: ownerId, symId: reference };
    if ('dependencyId' in reference) {
      throw new Error(`Template '${ownerId}' cannot use a dependency as a direct definition`);
    }
    return reference;
  };

  const resolveReferenceTargets = (
    kind: TemplateDependencyKind,
    ownerId: string,
    reference: SymbolicReference
  ): Array<{ templateId: string; symId: string }> => {
    if (typeof reference === 'object' && 'dependencyId' in reference) {
      const dependencyKey = templateDependencyKey(ownerId, reference.dependencyId);
      const dependency = dependencySources.get(dependencyKey);
      if (!dependency) {
        throw new Error(
          `Template '${ownerId}' references unknown dependency '${reference.dependencyId}'`
        );
      }
      if (dependency.kind !== kind) {
        throw new Error(
          `Template dependency '${dependencyKey}' targets ${dependency.kind}, not ${kind}`
        );
      }
      const targets = dependencyMappings.get(dependencyKey);
      if (!targets) {
        throw new Error(`Template dependency '${dependencyKey}' has no mapping`);
      }
      if (targets.length < dependency.minTargets) {
        throw new Error(
          `Template dependency '${dependencyKey}' requires at least ${dependency.minTargets} target${dependency.minTargets === 1 ? '' : 's'}`
        );
      }
      if (dependency.maxTargets !== undefined && targets.length > dependency.maxTargets) {
        throw new Error(
          `Template dependency '${dependencyKey}' accepts at most ${dependency.maxTargets} target${dependency.maxTargets === 1 ? '' : 's'}`
        );
      }
      const uniqueTargets = new Set(targets.map(target => `${target.templateId}:${target.symId}`));
      if (uniqueTargets.size !== targets.length) {
        throw new Error(`Template dependency '${dependencyKey}' contains duplicate targets`);
      }
      for (const target of targets) {
        if (!ids.get(kind)?.get(target.templateId)?.has(target.symId)) {
          throw new Error(
            `Template dependency '${dependencyKey}' targets unknown ${kind} '${target.templateId}:${target.symId}'`
          );
        }
      }
      return [...targets];
    }
    return [normalizeReference(ownerId, reference)];
  };

  const resolveDefinitionIds = (
    kind: TemplateDependencyKind,
    ownerId: string,
    reference: SymbolicReference
  ) =>
    resolveReferenceTargets(kind, ownerId, reference).map(normalized => {
      const id = ids.get(kind)?.get(normalized.templateId)?.get(normalized.symId);
      if (!id) {
        throw new Error(
          `Template '${ownerId}' references unknown ${kind} '${normalized.templateId}:${normalized.symId}'`
        );
      }
      return id;
    });

  const resolveDefinitionId = (
    kind: TemplateDependencyKind,
    ownerId: string,
    reference: SymbolicReference
  ) => {
    const resolved = resolveDefinitionIds(kind, ownerId, reference);
    if (resolved.length !== 1) {
      throw new Error(
        `Template '${ownerId}' requires exactly one ${kind} target for this reference`
      );
    }
    return resolved[0]!;
  };

  for (const fragment of fragments) {
    for (const patch of fragment.schemaFields) {
      const targets = resolveReferenceTargets('schema', fragment.ownerId, patch.target);
      for (const target of targets) {
        const key = definitionKey('schema', target.templateId, target.symId);
        const schema = schemaSources.get(key);
        if (!schema) {
          throw new Error(
            `Template '${fragment.ownerId}' extends unknown schema '${target.templateId}:${target.symId}'`
          );
        }
        const duplicateField = patch.fields.find(field =>
          schema.fields.some(existing => existing.id === field.id)
        );
        if (duplicateField) {
          throw new Error(
            `Template '${fragment.ownerId}' adds duplicate field '${duplicateField.id}' to schema '${target.templateId}:${target.symId}'`
          );
        }
        schema.fields = [...schema.fields, ...patch.fields];
      }
    }
  }

  const resolveField = (ownerId: string, field: SymbolicField): SchemaField => {
    if (field.type === 'reference') {
      return {
        id: field.id,
        name: field.name,
        predicate: field.predicate,
        type: 'reference',
        schemaId: resolveDefinitionId('schema', ownerId, field.symSchemaId),
        minCount: field.minCount,
        maxCount: field.maxCount,
        requirementLevel: field.minCount > 0 ? 'required' : 'optional'
      };
    }
    if (field.type === 'containment') {
      return {
        id: field.id,
        name: field.name,
        predicate: field.predicate,
        type: 'containment',
        schemaId: resolveDefinitionId('schema', ownerId, field.symSchemaId),
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
        enumId: resolveDefinitionId('enum', ownerId, field.enumId),
        minCardinality: field.minCardinality,
        maxCardinality: field.maxCardinality,
        requirementLevel: field.requirementLevel
      };
    }
    if (field.type === 'typedRelation') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        relationSchemaId: resolveDefinitionId('relationSchema', ownerId, field.symRelationSchemaId),
        direction: field.direction,
        minCount: field.minCount,
        maxCount: field.maxCount,
        requirementLevel: field.requirementLevel
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
          field.resultType === 'select' && field.enumId !== undefined
            ? resolveDefinitionId('enum', ownerId, field.enumId)
            : undefined
      };
    }
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      minCardinality: field.minCardinality,
      maxCardinality: field.maxCardinality,
      requirementLevel: field.requirementLevel
    };
  };

  const resolveRelationField = (
    ownerId: string,
    field: SymbolicRelationSchema['fields'][number]
  ) => {
    if (field.type === 'select') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        enumId: resolveDefinitionId('enum', ownerId, field.enumId),
        minCardinality: field.minCardinality,
        maxCardinality: field.maxCardinality,
        requirementLevel: field.requirementLevel
      } as RelationField;
    }
    if (field.type === 'entityRelation') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        predicate: field.predicate,
        schemaId: resolveDefinitionId('schema', ownerId, field.schemaId),
        minCount: field.minCount,
        maxCount: field.maxCount,
        requirementLevel: field.requirementLevel
      } as RelationField;
    }
    if (field.type === 'number') {
      return {
        id: field.id,
        name: field.name,
        type: field.type,
        min: field.min,
        max: field.max,
        requirementLevel: field.requirementLevel
      } as RelationField;
    }
    return {
      id: field.id,
      name: field.name,
      type: field.type,
      requirementLevel: field.requirementLevel
    } as RelationField;
  };

  const materialized = fragments.map<MaterializedTemplateModule>(fragment => {
    const schemaIds = ownerMap('schema', fragment.ownerId);
    const relationSchemaIds = ownerMap('relationSchema', fragment.ownerId);
    const documentTypeIds = ownerMap('documentType', fragment.ownerId);

    const categoryIdByName = new Map<string, string>();
    const categories: CategoryDbCreate[] = [];
    const resolveCategoryId = (name: string | null | undefined): string | null => {
      const trimmed = name?.trim();
      if (!trimmed) return null;
      const key = trimmed.toLowerCase();
      const existingId = categoryIdByName.get(key);
      if (existingId) return existingId;
      const id = deterministicCategoryId(workspaceId, trimmed);
      categoryIdByName.set(key, id);
      categories.push({
        id,
        workspace: workspaceId,
        name: trimmed,
        created_at: now,
        updated_at: now
      });
      return id;
    };

    const fieldGroups: SharedFieldGroupDbCreate[] = (fragment.template.fieldGroups ?? []).map(
      (fieldGroup, index) => ({
        id: ownerMap('fieldGroup', fragment.ownerId).get(fieldGroup.id)!,
        workspace: workspaceId,
        name: fieldGroup.name,
        category_id: resolveCategoryId(fieldGroup.category),
        description: fieldGroup.description ?? null,
        fields: fieldGroup.fields.map(field => resolveField(fragment.ownerId, field)),
        sort_order: index,
        created_at: now,
        updated_at: now
      })
    );

    const schemas: SchemaDbCreate[] = fragment.template.schemas.map(schema => {
      const source = schemaSources.get(definitionKey('schema', fragment.ownerId, schema.symId))!;
      const keyPrefix = normalizePublicIdPrefix(
        options.schemaKeyPrefixFactory?.(workspaceId, fragment.ownerId, schema.symId) ??
          generateTemplateSchemaKeyPrefix(workspaceId, schema.symId)
      );
      return {
        id: schemaIds.get(schema.symId)!,
        workspace: workspaceId,
        name: source.name,
        category_id: resolveCategoryId(source.category),
        description: source.description,
        key_prefix: keyPrefix,
        color: source.color,
        icon: source.icon,
        fields: source.fields.map(field => resolveField(fragment.ownerId, field)),
        shared_field_group_links: (source.sharedFieldGroupIds ?? []).flatMap(groupId =>
          resolveDefinitionIds('fieldGroup', fragment.ownerId, groupId).map(resolvedId => ({
            groupId: resolvedId
          }))
        ),
        default_owner: null,
        created_at: now,
        updated_at: now,
        ...(source.validationRules ? { validation_rules: source.validationRules } : {})
      };
    });

    const resolveEndpointSchemaIds = (schemaIds: SymbolicReference[] | 'any') =>
      schemaIds === 'any'
        ? 'any'
        : schemaIds.flatMap(schemaId => resolveDefinitionIds('schema', fragment.ownerId, schemaId));
    const relationSchemas: RelationSchemaDbCreate[] = (fragment.template.relationSchemas ?? []).map(
      relationSchema => ({
        id: relationSchemaIds.get(relationSchema.symId)!,
        workspace: workspaceId,
        name: relationSchema.name,
        category_id: resolveCategoryId(relationSchema.category),
        description: relationSchema.description,
        in_schema_ids: resolveEndpointSchemaIds(relationSchema.inSymSchemaIds),
        out_schema_ids: resolveEndpointSchemaIds(relationSchema.outSymSchemaIds),
        in_label: relationSchema.inLabel,
        out_label: relationSchema.outLabel,
        fields: relationSchema.fields.map(field => resolveRelationField(fragment.ownerId, field)),
        groups: [],
        shared_field_group_links: (relationSchema.sharedFieldGroupIds ?? []).flatMap(groupId =>
          resolveDefinitionIds('fieldGroup', fragment.ownerId, groupId).map(resolvedId => ({
            groupId: resolvedId
          }))
        ),
        color: relationSchema.color,
        icon: relationSchema.icon,
        relation_approval_policy: 'disabled',
        created_at: now,
        updated_at: now
      })
    );

    const enums: WorkspaceEnumDbCreate[] = fragment.template.enums.map((enumeration, index) => ({
      id: ownerMap('enum', fragment.ownerId).get(enumeration.id)!,
      workspace: workspaceId,
      name: enumeration.name,
      category_id: resolveCategoryId(enumeration.category),
      options: enumeration.options,
      sort_order: index,
      created_at: now,
      updated_at: now
    }));

    const documentTypes: DocumentTypeDbCreate[] = fragment.template.documentTypes.map(
      documentType => ({
        id: documentTypeIds.get(documentType.id)!,
        workspace: workspaceId,
        name: documentType.name,
        description: documentType.description,
        fields: documentType.fields,
        color: documentType.color,
        icon: documentType.icon,
        created_at: now,
        updated_at: now
      })
    );

    const documentTemplates: DocumentTemplateDbCreate[] = fragment.template.documentTemplates.map(
      documentTemplate => ({
        id: ownerMap('documentTemplate', fragment.ownerId).get(documentTemplate.id)!,
        workspace: workspaceId,
        project_id: null,
        name: documentTemplate.name,
        body: documentTemplate.body,
        document_type_id: resolveDefinitionId(
          'documentType',
          fragment.ownerId,
          documentTemplate.documentTypeId
        ),
        metadata_defaults: { ...documentTemplate.metadataDefaults },
        created_at: now,
        updated_at: now
      })
    );

    const resolveCapabilityTargetId = (target: {
      kind: WorkspaceCapabilityTargetKind;
      symId: SymbolicReference;
    }) => {
      const kind =
        target.kind === 'entity_schema'
          ? 'schema'
          : target.kind === 'relation_schema'
            ? 'relationSchema'
            : 'documentType';
      return resolveDefinitionId(kind, fragment.ownerId, target.symId);
    };
    const capabilityConfigurations = (fragment.template.capabilityConfigurations ?? []).map(
      configuration => ({
        type: configuration.type,
        bindings: Object.fromEntries(
          Object.entries(configuration.bindings).map(([bindingId, binding]) => [
            bindingId,
            {
              ...binding,
              target: {
                kind: binding.target.kind,
                id: resolveCapabilityTargetId(binding.target)
              }
            }
          ])
        ) as WorkspaceCapabilityBindings
      })
    );

    return {
      ownerId: fragment.ownerId,
      template: fragment.template,
      categories,
      schemas,
      enums,
      fieldGroups,
      relationSchemas,
      documentTypes,
      documentTemplates,
      dashboardWidgets: resolveTemplateDashboardWidgets(
        fragment.template.dashboardWidgets ?? [],
        schemaIds
      ),
      capabilityConfigurations,
      dashboardGroups:
        fragment.template.dashboardWidgets && fragment.template.dashboardWidgets.length > 0
          ? [
              {
                name: fragment.template.category === 'full' ? 'Overview' : fragment.template.name,
                widgets: resolveTemplateDashboardWidgets(
                  fragment.template.dashboardWidgets,
                  schemaIds
                )
              }
            ]
          : [],
      views: resolveTemplateSavedViews(
        fragment.template.views ?? [],
        workspaceId,
        schemaIds,
        relationSchemaIds,
        now
      )
    };
  });

  return materialized;
};

export const instantiateTemplateDefinitions = (
  workspaceId: string,
  templateId: string,
  now = new Date(),
  options: TemplateInstantiationOptions = {}
): InstantiatedTemplate => {
  const template = SCHEMA_TEMPLATES.find(item => item.id === templateId);
  if (!template) return emptyInstantiatedTemplate();
  const [module] = materializeTemplateFragments(
    workspaceId,
    createTemplateFragments([template], false),
    now,
    options
  );
  return module ?? emptyInstantiatedTemplate();
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
  now = new Date(),
  options: TemplateInstantiationOptions = {}
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
    ...emptyInstantiatedTemplate(),
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
  const emittedDefinitionIds = new Map<string, Set<string>>();
  const emitOnce = (kind: string, id: string) => {
    const emitted = emittedDefinitionIds.get(kind) ?? new Set<string>();
    emittedDefinitionIds.set(kind, emitted);
    if (emitted.has(id)) return false;
    emitted.add(id);
    return true;
  };

  const modules = materializeTemplateFragments(
    workspaceId,
    createTemplateFragments(selected, true),
    now,
    options
  );
  for (const module of modules) {
    for (const category of module.categories) {
      if (!emitOnce('category', category.id)) continue;
      result.categories.push(category);
    }
    for (const enumeration of module.enums) {
      if (!emitOnce('enum', enumeration.id)) continue;
      result.enums.push({
        ...enumeration,
        name: uniqueDefinitionName(namesFor('enum'), enumeration.name, module.template.name)
      });
    }
    for (const fieldGroup of module.fieldGroups) {
      if (!emitOnce('fieldGroup', fieldGroup.id)) continue;
      result.fieldGroups.push({
        ...fieldGroup,
        name: uniqueDefinitionName(namesFor('fieldGroup'), fieldGroup.name, module.template.name)
      });
    }
    for (const schema of module.schemas) {
      let keyPrefix = schema.key_prefix;
      let prefixSeed = 0;
      while (usedPrefixes.has(keyPrefix)) {
        prefixSeed += 1;
        keyPrefix = normalizePublicIdPrefix(
          generateTemplateSchemaKeyPrefix(
            `${workspaceId}:${module.ownerId}:${prefixSeed}`,
            schema.id
          )
        );
      }
      usedPrefixes.add(keyPrefix);
      result.schemas.push({
        ...schema,
        name: uniqueDefinitionName(namesFor('schema'), schema.name, module.template.name),
        key_prefix: keyPrefix
      });
    }
    for (const relationSchema of module.relationSchemas) {
      result.relationSchemas.push({
        ...relationSchema,
        name: uniqueDefinitionName(
          namesFor('relationSchema'),
          relationSchema.name,
          module.template.name
        )
      });
    }

    const documentTypeIdMap = new Map<string, string>();
    for (const documentType of module.documentTypes) {
      const existingId = documentTypeByName.get(documentType.name.toLocaleLowerCase());
      if (existingId) {
        documentTypeIdMap.set(documentType.id, existingId);
        continue;
      }
      const name = uniqueDefinitionName(
        namesFor('documentType'),
        documentType.name,
        module.template.name
      );
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
          module.template.name
        )
      });
    }
    result.capabilityConfigurations.push(...module.capabilityConfigurations);
    if (module.dashboardWidgets.length > 0) {
      const groupName = module.template.category === 'full' ? 'Overview' : module.template.name;
      result.dashboardGroups.push({ name: groupName, widgets: module.dashboardWidgets });
      result.dashboardWidgets.push(...module.dashboardWidgets);
    }
    for (const view of module.views) {
      result.views.push({
        ...view,
        name: uniqueDefinitionName(namesFor('savedView'), view.name, module.template.name)
      });
    }
  }

  return result;
};

export const instantiateTemplateDocuments = (
  workspaceId: string,
  templateId: string,
  now = new Date(),
  options: TemplateInstantiationOptions = {}
) => {
  const { documentTypes, documentTemplates } = instantiateTemplateDefinitions(
    workspaceId,
    templateId,
    now,
    options
  );
  return { documentTypes, documentTemplates };
};

export const instantiateTemplate = (
  workspaceId: string,
  templateId: string,
  now?: Date,
  options?: TemplateInstantiationOptions
): SchemaDbCreate[] =>
  instantiateTemplateDefinitions(workspaceId, templateId, now, options).schemas;
