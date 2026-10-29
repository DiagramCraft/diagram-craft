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
import { GENERIC_STARTER_DASHBOARD_WIDGETS } from '@arch-register/api-types/dashboardWidgetSeeds';
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
import {
  remapEntityDrawerProfiles,
  VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE,
  type EntityDrawerProfile
} from '@arch-register/api-types/entityDrawerConfiguration';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type { EntityQuery, PathStep, QueryNode } from '@arch-register/api-types/entityQueryIR';
import type { RelationSchemaDbCreate } from './db/relationDatabase';
import type { SavedViewDbCreate, CategoryDbCreate } from './db/catalogDatabase';
import { normalizePublicIdPrefix } from '../../utils/publicIds';
import { commonDocumentTemplates, commonDocumentTypes, enumDefinition } from './schemaTemplateBase';
import { glossarySchemaTemplate } from '../../app/business-glossary/glossarySchemaTemplate';

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

type SymbolicFieldVariant =
  | {
      id: string;
      name: string;
      type: 'text' | 'longtext' | 'boolean' | 'date' | 'currency' | 'duration' | 'principal';
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
      resultType: 'text' | 'number' | 'currency' | 'select' | 'boolean' | 'rating' | 'duration';
      enumId?: SymbolicReference;
      recalcInterval?: 'hourly' | 'daily';
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

// `groupId` (optional on every variant) names a schema-local, presentation-only field group
// declared in `TemplateSchema.groups`. It is threaded straight onto the compiled `SchemaField`
// and drives the default detail-screen layout (one panel per group); it never affects storage
// or validation.
// `description` (optional on every variant) is the user-facing explanation shown next to the
// field label in schema-driven screens.
export type SymbolicField = SymbolicFieldVariant & { groupId?: string; description?: string };

export type TemplateSchemaGroup = {
  id: string;
  name: string;
  description?: string;
};

export type TemplateSchema = {
  symId: string;
  name: string;
  description: string;
  category: string;
  color: string;
  icon: string;
  fields: SymbolicField[];
  groups?: TemplateSchemaGroup[];
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
  uniqueEndpointPair?: boolean;
  inSymSchemaIds: SymbolicReference[] | 'any';
  outSymSchemaIds: SymbolicReference[] | 'any';
  fields: Array<
    | {
        id: string;
        name: string;
        description?: string;
        type: 'select';
        enumId: SymbolicReference;
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
        minCardinality?: number;
        maxCardinality?: number;
      }
    | {
        id: string;
        name: string;
        description?: string;
        type: 'date';
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        description?: string;
        type: 'text' | 'longtext' | 'boolean';
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        description?: string;
        type: 'number';
        min?: number;
        max?: number;
        requirementLevel?: 'required' | 'expected' | 'optional' | null;
      }
    | {
        id: string;
        name: string;
        description?: string;
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
  /** Authored drawer profiles keyed by this template's schema symId. */
  entityDrawerProfiles?: Record<string, EntityDrawerProfile>;
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

const API_PARTICIPATION_DESCRIPTIONS: Record<string, string> = {
  provides_apis: 'The APIs this entity exposes to other systems and components.',
  consumes_apis: 'The APIs this entity calls or depends on.',
  providers: 'The components that implement and expose this API.',
  consumers: 'The components that call this API.'
};

const apiParticipationField = (
  id: string,
  name: string,
  relationSchemaId: SymbolicReference,
  direction: 'in' | 'out'
): SymbolicField => ({
  id,
  name,
  description: API_PARTICIPATION_DESCRIPTIONS[id],
  type: 'typedRelation',
  symRelationSchemaId: relationSchemaId,
  direction,
  minCount: 0,
  maxCount: -1,
  requirementLevel: null
});

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

const vendorCategoryEnum = enumDefinition(
  'vendor-category',
  'Vendor Category',
  [
    { value: 'software', label: 'Software' },
    { value: 'hardware', label: 'Hardware' },
    { value: 'cloud-hosting', label: 'Cloud / Hosting' },
    { value: 'professional-services', label: 'Professional Services' },
    { value: 'other', label: 'Other' }
  ],
  'Vendor'
);

const vendorTierEnum = enumDefinition(
  'vendor-tier',
  'Vendor Tier',
  [
    { value: 'strategic', label: 'Strategic' },
    { value: 'tactical', label: 'Tactical' },
    { value: 'commodity', label: 'Commodity' }
  ],
  'Vendor'
);

const vendorStatusEnum = enumDefinition(
  'vendor-status',
  'Vendor Status',
  [
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'active', label: 'Active' },
    { value: 'offboarding', label: 'Offboarding' },
    { value: 'inactive', label: 'Inactive' }
  ],
  'Vendor'
);

const vendorCostCentreEnum = enumDefinition(
  'vendor-cost-centre',
  'Cost Centre',
  [
    { value: 'engineering', label: 'Engineering' },
    { value: 'it-operations', label: 'IT Operations' },
    { value: 'sales-marketing', label: 'Sales & Marketing' },
    { value: 'finance-admin', label: 'Finance & Admin' },
    { value: 'other', label: 'Other' }
  ],
  'Vendor'
);

const contractTypeEnum = enumDefinition(
  'contract-type',
  'Contract Type',
  [
    { value: 'licence', label: 'Licence' },
    { value: 'support', label: 'Support' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'services', label: 'Services' }
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
      description: 'Whether and how the entity handles personally identifiable information.',
      type: 'select',
      enumId: 'pii-classification'
    },
    {
      id: 'pii_scope',
      name: 'PII Scope',
      description:
        'Which personal data is handled and for whom, for example customer email addresses.',
      type: 'text'
    }
  ]
};

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
      description:
        'Where the decision stands in its lifecycle, for example proposed, accepted or superseded.',
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
      description: 'The date the decision was made.',
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
    {
      id: 'product',
      name: 'Product',
      description: 'The name of the product or technology.',
      type: 'text'
    },
    {
      id: 'provider_product',
      name: 'Provider Product Key',
      description:
        'The key identifying this product at the release data provider, used for automatic synchronization.',
      type: 'text'
    },
    {
      id: 'category',
      name: 'Category',
      description: 'The kind of technology, such as language, database or framework.',
      type: 'select',
      enumId: 'technology-category'
    },
    {
      id: 'radar_status',
      name: 'Radar Status',
      description:
        'Where the technology sits on the technology radar: adopt, trial, assess or hold.',
      type: 'select',
      enumId: 'technology-radar-status'
    }
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
      description: 'The technology this release is a version of.',
      predicate: 'belongs to',
      type: 'containment',
      symSchemaId: 'technology',
      minCount: 1,
      maxCount: 1
    },
    {
      id: 'provider_product',
      name: 'Provider Product Key',
      description: 'The key identifying the product at the release data provider.',
      type: 'text'
    },
    {
      id: 'release_cycle',
      name: 'Release Cycle',
      description: 'The release line this version belongs to, such as 3.2 or 2024 LTS.',
      type: 'text'
    },
    {
      id: 'latest_version',
      name: 'Latest Version',
      description: 'The newest patch version within this release cycle.',
      type: 'text'
    },
    {
      id: 'release_date',
      name: 'Release Date',
      description: 'The date this release became generally available.',
      type: 'date'
    },
    {
      id: 'active_support_until',
      name: 'Active Support Until',
      description: 'The date the vendor stops providing active support and fixes.',
      type: 'date'
    },
    {
      id: 'security_support_until',
      name: 'Security Support Until',
      description: 'The date the vendor stops providing security patches.',
      type: 'date'
    },
    {
      id: 'eol_date',
      name: 'EOL Date',
      description: 'The date the release reaches end of life and is no longer supported.',
      type: 'date'
    },
    {
      id: 'source_url',
      name: 'Source URL',
      description: 'A link to the page the release information was taken from.',
      type: 'text'
    },
    {
      id: 'last_synchronized',
      name: 'Last Synchronized',
      description: 'The date the release information was last refreshed from its source.',
      type: 'date'
    },
    {
      id: 'category',
      name: 'Category',
      description: 'The kind of technology this release belongs to.',
      type: 'select',
      enumId: 'technology-category'
    },
    {
      id: 'radar_status',
      name: 'Radar Status',
      description: 'Where this release sits on the technology radar: adopt, trial, assess or hold.',
      type: 'select',
      enumId: 'technology-radar-status'
    }
  ]
};

const technologyReleaseReference = (): SymbolicField => ({
  id: 'technology_releases',
  name: 'Technology Releases',
  description: 'The technology releases this entity is built on or runs on.',
  predicate: 'uses',
  type: 'reference',
  symSchemaId: 'technology_release',
  minCount: 0,
  maxCount: -1
});

// Business Glossary's schema template pack lives in ../../app/business-glossary/glossarySchemaTemplate.ts
// and is spread into SCHEMA_TEMPLATES below, alongside the other cross-cutting concern packs.

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

const strategyMeasureDirectionEnum = enumDefinition(
  'measure-direction',
  'Measure Direction',
  [
    { value: 'up-is-better', label: 'Up is better' },
    { value: 'down-is-better', label: 'Down is better' }
  ],
  'Strategy'
);

const capabilityTypeEnum = enumDefinition(
  'capability-type',
  'Capability Type',
  [
    { value: 'core', label: 'Core', description: 'Directly differentiates the business.' },
    {
      value: 'supporting',
      label: 'Supporting',
      description: 'Enables core capabilities but is not itself a differentiator.'
    },
    {
      value: 'generic',
      label: 'Generic / Enabling',
      description: 'Commodity capability common to most organisations.'
    }
  ],
  'Strategy'
);

const capabilityHealthEnum = enumDefinition(
  'capability-health',
  'Capability Health',
  [
    { value: 'green', label: 'Green', description: 'Performing to expectations.' },
    { value: 'amber', label: 'Amber', description: 'Some concerns; watch closely.' },
    { value: 'red', label: 'Red', description: 'Underperforming; needs intervention.' }
  ],
  'Strategy'
);

const strategicImportanceEnum = enumDefinition(
  'strategic-importance',
  'Strategic Importance',
  [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'critical', label: 'Critical' }
  ],
  'Strategy'
);

const investmentPriorityEnum = enumDefinition(
  'investment-priority',
  'Investment Priority',
  [
    { value: 'invest', label: 'Invest', description: 'Grow and improve the capability.' },
    { value: 'tolerate', label: 'Tolerate', description: 'Keep running with minimal spend.' },
    { value: 'migrate', label: 'Migrate', description: 'Re-platform or consolidate.' },
    { value: 'eliminate', label: 'Eliminate', description: 'Retire or divest.' }
  ],
  'Strategy'
);

const capabilityReferenceModelEnum = enumDefinition(
  'capability-reference-model',
  'Capability Reference Model',
  [
    { value: 'apqc-pcf', label: 'APQC PCF' },
    { value: 'bian', label: 'BIAN' },
    { value: 'tm-forum-etom', label: 'TM Forum eTOM' },
    { value: 'custom', label: 'Custom / Internal' }
  ],
  'Strategy'
);

// Business Capability carries the high-value enterprise-architecture attributes for
// capability-based planning (issue #3202). Intent of the non-obvious ones:
//   - capability_type    core / supporting / generic — differentiation, drives portfolio focus
//   - value_stream       free text; the value stream or domain the capability serves
//   - stakeholders       accountable/interested people beyond the owning team
//   - maturity/…_target  current vs. desired maturity (1-5); `gap` is the derived delta
//   - health             RAG performance rating, independent of maturity
//   - criticality        1-5 business criticality; paired with maturity for heatmaps
//   - strategic_importance / investment_priority  planning stance (investment_priority = TIME model)
//   - target_state       narrative of the aspired end state
//   - last_assessed      date the capability was last formally reviewed
//   - reference_model/_code  mapping to an external framework (APQC PCF, BIAN, TM Forum eTOM)
// Identity (name, code), description, owner, lifecycle, tags and change history come from
// built-in entity metadata; supported applications/systems/data/etc. come from the existing
// `supported_entities` (Business Capability Supports Entity) relation. Fields are organised
// into presentation-only `groups` that the default detail layout renders as panels.
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
        description: 'The broader capability this capability is a part of.',
        type: 'containment',
        symSchemaId: 'business_capability',
        minCount: 0,
        maxCount: 1
      },
      {
        id: 'capability_type',
        name: 'Capability Type',
        description: 'The role of the capability, such as strategic, core or supporting.',
        type: 'select',
        enumId: 'capability-type',
        requirementLevel: 'optional'
      },
      {
        id: 'value_stream',
        name: 'Value Stream',
        description: 'The value stream the capability contributes to.',
        type: 'text'
      },
      {
        id: 'capability_level',
        name: 'Capability Level',
        description:
          'Calculated: the depth of the capability in the hierarchy, where L1 is top-level.',
        type: 'derived',
        expression:
          "entity.parent == null ? 'L1' : `L${toNumber(entity.parent.capability_level.replace('L', '')) + 1}`",
        resultType: 'text'
      },
      {
        id: 'stakeholders',
        name: 'Stakeholders',
        description: 'The people with an interest in or responsibility for this capability.',
        type: 'principal',
        minCardinality: 0,
        maxCardinality: -1,
        requirementLevel: 'optional'
      },
      {
        id: 'maturity',
        name: 'Maturity',
        description: 'The current maturity of the capability, from 1 (initial) to 5 (optimized).',
        type: 'number',
        min: 1,
        max: 5,
        groupId: 'maturity-performance'
      },
      {
        id: 'maturity_target',
        name: 'Maturity Target',
        description: 'The maturity level the capability should reach.',
        type: 'number',
        min: 1,
        max: 5,
        groupId: 'maturity-performance'
      },
      {
        id: 'health',
        name: 'Health',
        description: 'An overall assessment of how well the capability is performing.',
        type: 'select',
        enumId: 'capability-health',
        requirementLevel: 'optional',
        groupId: 'maturity-performance'
      },
      {
        id: 'criticality',
        name: 'Business Criticality',
        description: 'How important the capability is to the business, from 1 (low) to 5 (high).',
        type: 'number',
        min: 1,
        max: 5,
        groupId: 'strategic-assessment'
      },
      {
        id: 'strategic_importance',
        name: 'Strategic Importance',
        description: "How much the capability matters to the organization's strategy.",
        type: 'select',
        enumId: 'strategic-importance',
        requirementLevel: 'optional',
        groupId: 'strategic-assessment'
      },
      {
        id: 'investment_priority',
        name: 'Investment Priority',
        description:
          'How the capability should be prioritized for investment, for example invest, maintain or divest.',
        type: 'select',
        enumId: 'investment-priority',
        requirementLevel: 'optional',
        groupId: 'strategic-assessment'
      },
      {
        id: 'target_state',
        name: 'Target State',
        description: 'A description of where the capability should be in the future.',
        type: 'longtext',
        groupId: 'strategic-assessment'
      },
      {
        id: 'annual_investment',
        name: 'Annual Investment',
        description: 'The yearly amount invested in the capability.',
        type: 'currency',
        groupId: 'investment-risk'
      },
      {
        id: 'risk',
        name: 'Risk',
        description: 'The level of risk associated with the capability, from 1 (low) to 5 (high).',
        type: 'number',
        min: 1,
        max: 5,
        groupId: 'investment-risk'
      },
      {
        id: 'target_date',
        name: 'Target Date',
        description: 'The date by which the capability is planned to reach its target state.',
        type: 'date',
        groupId: 'lifecycle-review'
      },
      {
        id: 'last_assessed',
        name: 'Last Assessed',
        description: 'The date the capability was last assessed.',
        type: 'date',
        groupId: 'lifecycle-review'
      },
      {
        id: 'reference_model',
        name: 'Reference Model',
        description: 'The industry reference model this capability is mapped to.',
        type: 'select',
        enumId: 'capability-reference-model',
        requirementLevel: 'optional',
        groupId: 'reference-models'
      },
      {
        id: 'reference_code',
        name: 'Reference Code',
        description: "The capability's identifier within the reference model.",
        type: 'text',
        groupId: 'reference-models'
      },
      {
        id: 'gap',
        name: 'Maturity Gap',
        description: 'Calculated: the target maturity minus the current maturity.',
        type: 'derived',
        groupId: 'maturity-performance',
        // `==` in this expression language is strict (`===`), so `entity.maturity == null` only
        // catches an explicitly-stored `null` - a capability that simply never had `maturity` set
        // (common for group-level capabilities with no metrics of their own) leaves it `undefined`,
        // which the strict check misses and the subtraction below then turns into `NaN` (rejected
        // by `resultType: 'number'`'s integer check). `?? null` normalizes both cases first.
        expression:
          '(entity.maturity ?? null) == null || (entity.maturity_target ?? null) == null ? null : entity.maturity_target - entity.maturity',
        resultType: 'number'
      },
      {
        id: 'supporting_objectives',
        name: 'Supported by Objectives',
        description: 'The objectives this capability helps to achieve.',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-supports-business-capability',
        direction: 'out',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'supported_entities',
        name: 'Supports Entities',
        description: 'The entities that rely on this capability.',
        type: 'typedRelation',
        symRelationSchemaId: 'business-capability-supports-entity',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      }
    ],
    groups: [
      {
        id: 'maturity-performance',
        name: 'Maturity & Performance',
        description: 'How well the capability performs today versus its target.'
      },
      {
        id: 'strategic-assessment',
        name: 'Strategic Assessment',
        description: 'Importance, criticality, investment stance, and target state.'
      },
      { id: 'investment-risk', name: 'Investment & Risk' },
      { id: 'lifecycle-review', name: 'Lifecycle & Review' },
      {
        id: 'reference-models',
        name: 'Reference Models',
        description: 'Mapping to an external capability framework (APQC PCF, BIAN, TM Forum eTOM).'
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
      {
        id: 'description',
        name: 'Description',
        description: 'A short summary of what this is and why it matters.',
        type: 'longtext'
      },
      {
        id: 'status',
        name: 'Status',
        description: 'Where the objective stands, for example planned, in progress or achieved.',
        type: 'select',
        enumId: 'strategy-status'
      },
      {
        id: 'target_date',
        name: 'Target Date',
        description: 'The date the objective should be achieved.',
        type: 'date'
      },
      {
        id: 'supported_capabilities',
        name: 'Supports',
        description: 'The capabilities that support this objective.',
        type: 'typedRelation',
        symRelationSchemaId: 'objective-supports-business-capability',
        direction: 'in',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'affected_entities',
        name: 'Affects',
        description: 'The entities that are affected by or contribute to this objective.',
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
      {
        id: 'description',
        name: 'Description',
        description: 'A short summary of what this is and why it matters.',
        type: 'longtext'
      },
      {
        id: 'objectives',
        name: 'Objectives',
        description: 'The objectives this outcome contributes to.',
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
      {
        id: 'description',
        name: 'Description',
        description: 'A short summary of what this is and why it matters.',
        type: 'longtext'
      },
      {
        id: 'status',
        name: 'Status',
        description: 'Where the initiative is, for example proposed, in progress or complete.',
        type: 'select',
        enumId: 'strategy-status'
      },
      {
        id: 'objectives',
        name: 'Objectives',
        description: 'The objectives this initiative is meant to advance.',
        predicate: 'pursues',
        type: 'reference',
        symSchemaId: 'objective',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'outcomes',
        name: 'Outcomes',
        description: 'The outcomes this initiative is expected to deliver.',
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
      {
        id: 'description',
        name: 'Description',
        description: 'A short summary of what this is and why it matters.',
        type: 'longtext'
      },
      {
        id: 'unit',
        name: 'Unit',
        description: 'The unit the measure is expressed in, such as percent or milliseconds.',
        type: 'text'
      },
      {
        id: 'baseline',
        name: 'Baseline',
        description: 'The value at the start, before any change.',
        type: 'number'
      },
      {
        id: 'current',
        name: 'Current',
        description: 'The most recent measured value.',
        type: 'number'
      },
      {
        id: 'target_value',
        name: 'Target Value',
        description: 'The value the measure should reach.',
        type: 'number'
      },
      {
        id: 'direction',
        name: 'Direction',
        description: 'Whether a higher or a lower value is better.',
        type: 'select',
        enumId: 'measure-direction'
      },
      {
        id: 'outcomes',
        name: 'Outcomes',
        description: 'The outcomes this measure is used to track.',
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
    'risk-category',
    'Risk Category',
    [
      { value: 'privacy', label: 'Privacy' },
      { value: 'security', label: 'Security' },
      { value: 'operational', label: 'Operational' },
      { value: 'regulatory', label: 'Regulatory' },
      { value: 'third-party', label: 'Third-party' },
      { value: 'records', label: 'Records' }
    ],
    'Governance'
  ),
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
  communicationProtocolEnum
];

const retentionPolicySchema: TemplateSchema = {
  symId: 'retention-policy',
  name: 'Retention Policy',
  description: 'A named retention policy defining how long data governed by it may be retained.',
  category: 'Governance',
  color: AR_COLOR_RED,
  icon: 'clock',
  fields: [
    {
      id: 'period',
      name: 'Period',
      description: 'How long records governed by this policy must be kept before disposal.',
      type: 'duration'
    },
    {
      id: 'governed_entities',
      name: 'Governed Entities',
      description: 'The entities that must follow this retention policy.',
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
    'Assigns a retention policy to a governed Data Entity category, recording the date it became ' +
    'subject to it.',
  category: 'Governance',
  inLabel: 'Subject to Retention Policy',
  outLabel: 'Governs',
  // Retention is a category-level concept — the "activated from" date and the policy's
  // duration/time-unit only ever describe the category as a whole, never an individual record's
  // own age, so the governed side is constrained to the Data Entity schema this same template
  // ships (retentionPolicySchema/dataEntitySchema are always composed together, so this adds no
  // cross-template dependency). Assigning a retention policy directly to a System, Application, or
  // other non-category entity mixes two different granularities under one policy — see the Risk &
  // Compliance app's Retention section for the UI consequence this was designed to prevent.
  inSymSchemaIds: ['data-entity'],
  outSymSchemaIds: ['retention-policy'],
  fields: [
    {
      id: 'activated_from',
      name: 'Activated From',
      description: 'The date the retention policy started to apply.',
      type: 'date',
      requirementLevel: 'required'
    }
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
    {
      id: 'steward',
      name: 'Steward',
      description: 'The person accountable for the quality and correct use of this asset.',
      type: 'principal',
      requirementLevel: 'expected'
    },
    {
      id: 'custodian',
      name: 'Custodian',
      description: 'The person or team responsible for the technical safekeeping of this asset.',
      type: 'principal',
      requirementLevel: 'expected'
    },
    {
      id: 'review_date',
      name: 'Review Date',
      description: "The date the asset's stewardship details are next due to be reviewed.",
      type: 'date',
      requirementLevel: 'expected'
    },
    {
      id: 'regulatory_tags',
      name: 'Regulatory Tags',
      description: 'Regulations or standards that apply to this asset, such as GDPR or HIPAA.',
      type: 'select',
      enumId: 'regulatory-tags',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'processing_purposes',
      name: 'Processing Purposes',
      description: 'The reasons this asset is processed, used to check processing is lawful.',
      type: 'select',
      enumId: 'processing-purposes',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'permitted_residency_regions',
      name: 'Permitted Residency Regions',
      description: 'Regions where this asset is allowed to be stored or processed.',
      type: 'select',
      enumId: 'residency-regions',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'review_status',
      name: 'Review Status',
      description: 'Calculated from the review date: incomplete, overdue, due soon or current.',
      type: 'derived',
      // 'incomplete' when no review date is set; otherwise bucketed against the current date
      // (entity.now, injected by the derived-field engine) with a 30-day "approaching" window.
      // Kept current between reviews by the derived-fields.recalculate-scan job.
      expression:
        "daysBetween(entity.now, entity.review_date) == null ? 'incomplete' " +
        ": daysBetween(entity.now, entity.review_date) < 0 ? 'overdue' " +
        ": daysBetween(entity.now, entity.review_date) <= 30 ? 'approaching' : 'current'",
      resultType: 'text',
      recalcInterval: 'daily'
    },
    {
      id: 'stewardship_status',
      name: 'Stewardship Status',
      description: 'Complete once a steward, a custodian and a review date are all recorded.',
      type: 'derived',
      // 'complete' only when a steward, custodian and review date are all recorded. Owner is a
      // built-in field (not reachable from derived expressions) and is already queryable via
      // _owner, so it is intentionally excluded here.
      expression:
        'isBlank(entity.steward) || isBlank(entity.custodian) || isBlank(entity.review_date) ' +
        "? 'incomplete' : 'complete'",
      resultType: 'text'
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
      description: 'Regulations or standards that apply to this data flow.',
      type: 'select',
      enumId: 'regulatory-tags',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'processing_purposes',
      name: 'Processing Purposes',
      description: 'The reasons data is transferred in this flow.',
      type: 'select',
      enumId: 'processing-purposes',
      minCardinality: 0,
      maxCardinality: -1
    },
    {
      id: 'source_residency_region',
      name: 'Source Residency Region',
      description: 'The region the data leaves from.',
      type: 'select',
      enumId: 'residency-regions',
      requirementLevel: 'optional'
    },
    {
      id: 'destination_residency_region',
      name: 'Destination Residency Region',
      description: 'The region the data arrives in.',
      type: 'select',
      enumId: 'residency-regions',
      requirementLevel: 'optional'
    },
    {
      id: 'cross_boundary',
      name: 'Cross-Boundary Transfer',
      description:
        'Calculated: whether the data moves between regions, stays within one, or is incomplete.',
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
      description:
        'Calculated: whether the destination region is allowed by the data carried in this flow.',
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
      description: 'The sensitivity level of the data, which determines how it must be handled.',
      type: 'select',
      enumId: 'pii-classification',
      requirementLevel: 'optional'
    },
    // Reverse side of retentionPolicySchema's 'governed_entities' — same template, so a plain
    // symId reference rather than the cross-template `{ templateId, symId }` form composition
    // extensions use (see 'protecting_controls' below for that form). A Data Entity category
    // normally sits under one retention policy at a time, hence maxCount: 1 — retentionAssignment
    // RelationSchema's `inSymSchemaIds` is constrained to this schema for the same reason
    // (retention is category-level, not per-record).
    {
      id: 'retention_policy',
      name: 'Retention Policy',
      description: 'The retention policy that governs how long this data is kept.',
      type: 'typedRelation',
      symRelationSchemaId: 'retention-assignment',
      direction: 'in',
      minCount: 0,
      maxCount: 1
    }
  ],
  sharedFieldGroupIds: ['information-asset-stewardship']
};

const dataFlowExtensionTemplateId = 'information-governance:data-flow';

// The 'risk-compliance' template's 'control-protection' composition extension (below, on the
// 'risk-compliance' template) — its synthetic fragment owner id, for cross-fragment
// `symRelationSchemaId` references from Control's `protected_entities` field. Mirrors
// `dataFlowExtensionTemplateId` immediately above.
const controlProtectionExtensionTemplateId = 'risk-compliance:control-protection';

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
      description: 'Whether data moves one way or both ways between the two ends of the flow.',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'data-flow-direction' },
      requirementLevel: 'required'
    },
    {
      id: 'data_classification',
      name: 'Data Classification',
      description: 'The sensitivity of the data carried by this flow.',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'pii-classification' },
      requirementLevel: 'required'
    },
    {
      id: 'protocol',
      name: 'Protocol',
      description: 'The communication protocol or transfer mechanism the flow uses.',
      type: 'select',
      enumId: { templateId: 'information-governance', symId: 'communication-protocol' },
      requirementLevel: 'optional'
    },
    {
      id: 'data_entities',
      name: 'Data',
      description: 'The data entities carried by this flow.',
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
  glossarySchemaTemplate,
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
    entityDrawerProfiles: {
      'data-entity': {
        header: {
          badges: [{ kind: 'field', fieldId: 'classification', showLabel: false }]
        },
        sections: [
          {
            id: 'attributes',
            title: 'Attributes',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'classification' },
              { kind: 'relation', fieldId: 'retention_policy', presentation: 'mini-panel' }
            ]
          },
          {
            id: 'stewardship',
            title: 'Stewardship',
            collapsible: false,
            items: [
              { kind: 'metadata', slot: 'owner' },
              { kind: 'field', fieldId: 'steward' },
              { kind: 'field', fieldId: 'custodian' },
              { kind: 'field', fieldId: 'review_date' },
              { kind: 'field', fieldId: 'review_status' },
              { kind: 'field', fieldId: 'stewardship_status' },
              { kind: 'field', fieldId: 'regulatory_tags' },
              { kind: 'field', fieldId: 'processing_purposes' },
              { kind: 'field', fieldId: 'permitted_residency_regions' }
            ]
          },
          {
            id: 'queue-items',
            title: 'Queue items',
            collapsible: true,
            items: [{ kind: 'slot', slotId: 'entity.governance-items', showLabel: false }]
          },
          {
            id: 'cases',
            title: 'Cases',
            collapsible: true,
            items: [{ kind: 'slot', slotId: 'entity.change-cases', showLabel: false }]
          },
          {
            id: 'assessments',
            title: 'Assessments',
            collapsible: true,
            items: [{ kind: 'slot', slotId: 'entity.assessments', showLabel: false }]
          }
        ]
      }
    },
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
                description: 'Data flows that send data from this entity to others.',
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
                description: 'Data flows that deliver data to this entity from others.',
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
            description: 'The domain this system belongs to.',
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
            description:
              'Contracts that cover the use of this system, such as licences and support agreements.',
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
            description: "Calculated: this system's share of the annual cost of its contracts.",
            type: 'derived',
            expression:
              'entity.contracts.map(.allocation * .entity.annual_cost.amount / 100).sum()',
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
            description: 'The system this component is part of.',
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
            description: 'Other components this component needs in order to work.',
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
          {
            id: 'api_type',
            name: 'Type',
            description: 'The style of API, such as REST, GraphQL or event stream.',
            type: 'select',
            enumId: 'api-type'
          },
          {
            id: 'protocols',
            name: 'Protocols',
            description: 'The communication protocols the API can be reached over.',
            type: 'select',
            enumId: 'communication-protocol',
            requirementLevel: 'required',
            minCardinality: 1,
            maxCardinality: -1
          },
          {
            id: 'system',
            name: 'System',
            description: 'The system that owns this API.',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'api_version',
            name: 'API Version',
            description: 'The version identifier of the API.',
            type: 'text'
          },
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
          {
            id: 'resource_type',
            name: 'Type',
            description: 'The kind of resource, such as database, queue or storage bucket.',
            type: 'text'
          },
          technologyReleaseReference(),
          {
            id: 'system',
            name: 'System',
            description: 'The system this resource belongs to.',
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
            description: 'The vendor the contract is made with.',
            predicate: 'provided by',
            type: 'containment',
            symSchemaId: 'vendor',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'contract_start',
            name: 'Contract Start',
            description: 'The date the contract takes effect.',
            type: 'date'
          },
          {
            id: 'contract_end',
            name: 'Contract End',
            description: 'The date the contract expires.',
            type: 'date'
          },
          {
            id: 'annual_cost',
            name: 'Annual Cost',
            description: 'The yearly recurring cost of the contract.',
            type: 'currency'
          },
          {
            id: 'setup_fee',
            name: 'Setup Fee',
            description: 'A one-off fee paid when the contract is started.',
            type: 'currency'
          },
          {
            id: 'allocated',
            name: 'Allocated',
            description:
              'Calculated: the total share of the contract that has been assigned to systems.',
            type: 'derived',
            expression: 'entity.system.map(.allocation).sum()',
            resultType: 'number'
          },
          {
            id: 'system',
            name: 'Used by',
            description: 'The systems that use this contract and how much of it each takes.',
            type: 'typedRelation',
            symRelationSchemaId: 'system-contract',
            direction: 'out',
            minCount: 0,
            maxCount: -1,
            requirementLevel: null
          },
          {
            id: 'contract_type',
            name: 'Contract Type',
            description: 'The kind of contract, such as licence, support or subscription.',
            type: 'select',
            enumId: 'contract-type',
            groupId: 'terms'
          },
          {
            id: 'auto_renew',
            name: 'Auto-Renew',
            description: 'Whether the contract renews automatically at the end of its term.',
            type: 'boolean',
            groupId: 'terms'
          },
          {
            id: 'notice_period',
            name: 'Notice Period',
            description:
              'How long before the end date notice must be given to cancel or change the contract.',
            type: 'duration',
            groupId: 'terms'
          },
          {
            id: 'contract_owner',
            name: 'Contract Owner',
            description: 'The person responsible for managing this contract.',
            type: 'text',
            groupId: 'ownership'
          }
        ],
        groups: [
          { id: 'terms', name: 'Terms' },
          { id: 'ownership', name: 'Ownership' }
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
        fields: [
          {
            id: 'category',
            name: 'Category',
            description: 'The type of product or service the vendor supplies.',
            type: 'select',
            enumId: 'vendor-category',
            groupId: 'classification'
          },
          {
            id: 'tier',
            name: 'Tier',
            description:
              'How important the vendor is to the business, used to decide the level of oversight.',
            type: 'select',
            enumId: 'vendor-tier',
            groupId: 'classification'
          },
          {
            id: 'status',
            name: 'Status',
            description: 'Where the vendor stands, for example prospective, active or exiting.',
            type: 'select',
            enumId: 'vendor-status',
            groupId: 'classification'
          },
          {
            id: 'relationship_owner',
            name: 'Relationship Owner',
            description: 'The person who manages the relationship with this vendor.',
            type: 'text',
            groupId: 'ownership'
          },
          {
            id: 'cost_centre',
            name: 'Cost Centre',
            description: 'The cost centre that pays for this vendor.',
            type: 'select',
            enumId: 'vendor-cost-centre',
            groupId: 'ownership'
          },
          {
            id: 'security_risk',
            name: 'Security Risk',
            description:
              'Assessed security risk of relying on this vendor, from 1 (low) to 5 (high).',
            type: 'number',
            min: 1,
            max: 5,
            groupId: 'risk'
          },
          {
            id: 'concentration_risk',
            name: 'Concentration Risk',
            description:
              'Risk from depending too heavily on this vendor, from 1 (low) to 5 (high).',
            type: 'number',
            min: 1,
            max: 5,
            groupId: 'risk'
          },
          {
            id: 'financial_risk',
            name: 'Financial Risk',
            description: 'Risk that the vendor is financially unstable, from 1 (low) to 5 (high).',
            type: 'number',
            min: 1,
            max: 5,
            groupId: 'risk'
          },
          {
            id: 'compliance_risk',
            name: 'Compliance Risk',
            description:
              'Risk that the vendor causes regulatory or compliance problems, from 1 (low) to 5 (high).',
            type: 'number',
            min: 1,
            max: 5,
            groupId: 'risk'
          },
          {
            id: 'criticality',
            name: 'Criticality',
            description: 'How critical the vendor is to the business, from 1 (low) to 5 (high).',
            type: 'number',
            min: 1,
            max: 5,
            groupId: 'risk'
          },
          {
            id: 'risk',
            name: 'Risk',
            description:
              'Calculated: a weighted score of the four risk ratings, adjusted by criticality.',
            type: 'derived',
            groupId: 'risk',
            expression:
              'isBlank(entity.security_risk) || isBlank(entity.concentration_risk) || ' +
              'isBlank(entity.financial_risk) || isBlank(entity.compliance_risk) ? null : ' +
              'clamp(round((entity.security_risk * 0.34 + entity.concentration_risk * 0.28 + ' +
              'entity.financial_risk * 0.22 + entity.compliance_risk * 0.16) * ' +
              '(1 + ((entity.criticality ?? 3) - 3) * 0.06)), 1, 5)',
            resultType: 'rating'
          },
          {
            id: 'spend',
            name: 'Annual Spend',
            description: 'Calculated: the total annual cost of all contracts with this vendor.',
            type: 'derived',
            groupId: 'ownership',
            // Sum of annual_cost across the vendor's Contracts (entity.referrers are the entities
            // pointing at this vendor, i.e. Contract.vendor). Converted to the workspace
            // currency via entity.fx; without exchange rates only single-currency vendors resolve. `?? []` because mutation paths that
            // skip the projection (create, seed) evaluate without `referrers`; the follow-up
            // recalculation fills it in.
            expression: 'sumCurrency((entity.referrers ?? []).map(.annual_cost), entity.fx)',
            resultType: 'currency',
            recalcInterval: 'daily'
          },
          {
            id: 'next_renewal',
            name: 'Next Renewal',
            description:
              "Calculated: the earliest upcoming contract end date among this vendor's contracts.",
            type: 'derived',
            groupId: 'ownership',
            // Earliest upcoming Contract.contract_end. Kept current by the daily recalculation scan.
            expression:
              'earliestOnOrAfter((entity.referrers ?? []).map(.contract_end), entity.now)',
            resultType: 'text',
            recalcInterval: 'daily'
          }
        ],
        groups: [
          { id: 'classification', name: 'Classification' },
          { id: 'ownership', name: 'Ownership' },
          { id: 'risk', name: 'Risk' }
        ]
      },
      technologySchema,
      technologyReleaseSchema
    ],
    enums: [
      backstageEnums[0]!,
      communicationProtocolEnum,
      piiClassificationEnum,
      contractPurposeEnum,
      vendorCategoryEnum,
      vendorTierEnum,
      vendorStatusEnum,
      vendorCostCentreEnum,
      contractTypeEnum,
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
            description: 'What the contract is used for within the system.',
            type: 'select',
            enumId: 'contract-purpose',
            requirementLevel: 'required'
          },
          {
            id: 'allocation',
            name: 'Allocation',
            description: "The percentage of the contract's cost that is attributed to this system.",
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
    ],
    entityDrawerProfiles: {
      api: {
        header: {
          badges: [
            { kind: 'field', fieldId: 'protocols', showLabel: false },
            { kind: 'metadata', slot: 'lifecycle' }
          ]
        },
        sections: [
          {
            id: 'attributes',
            title: 'Attributes',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'api_version', label: 'API version' },
              { kind: 'metadata', slot: 'owner' }
            ]
          },
          {
            id: 'providers',
            title: 'Providers',
            collapsible: false,
            items: [{ kind: 'relation', fieldId: 'providers', label: 'Providers' }]
          },
          {
            id: 'consumers',
            title: 'Consumers',
            collapsible: false,
            items: [{ kind: 'relation', fieldId: 'consumers', label: 'Consumers' }]
          }
        ]
      },
      vendor: {
        header: {
          badges: [
            { kind: 'field', fieldId: 'tier', showLabel: false },
            { kind: 'field', fieldId: 'status', showLabel: false }
          ]
        },
        sections: [
          {
            id: 'risk-profile',
            title: 'Risk profile',
            collapsible: false,
            layout: 'stat-grid',
            items: [
              { kind: 'field', fieldId: 'security_risk', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'concentration_risk', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'financial_risk', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'compliance_risk', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'criticality', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'risk', presentation: 'mini-panel' }
            ]
          },
          {
            id: 'attributes',
            title: 'Attributes',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'category' },
              { kind: 'field', fieldId: 'tier' },
              { kind: 'field', fieldId: 'status' },
              { kind: 'field', fieldId: 'relationship_owner' },
              { kind: 'field', fieldId: 'cost_centre' }
            ]
          },
          {
            id: 'spend',
            title: 'Spend',
            collapsible: true,
            layout: 'stat-grid',
            items: [
              {
                kind: 'rollup',
                sourceSchemaId: 'contract',
                fieldId: 'annual_cost',
                traversal: {
                  kind: 'relation',
                  fieldId: 'vendor',
                  direction: 'backward',
                  ownerSchemaId: 'contract'
                },
                aggregation: 'sum',
                format: 'currency',
                label: 'vmSpend'
              },
              {
                kind: 'rollup',
                sourceSchemaId: 'contract',
                fieldId: 'annual_cost',
                traversal: {
                  kind: 'relation',
                  fieldId: 'vendor',
                  direction: 'backward',
                  ownerSchemaId: 'contract'
                },
                aggregation: 'count',
                format: 'number',
                label: 'Contracts'
              }
            ]
          },
          {
            id: 'contracts',
            title: 'Contracts',
            collapsible: true,
            items: [
              {
                kind: 'query',
                queryText: '<-"Contract".vendor',
                label: 'Contracts',
                showLabel: false,
                presentation: 'list',
                fields: [{ fieldId: 'annual_cost', label: 'Annual cost' }]
              }
            ]
          },
          {
            id: 'applications-supplied',
            title: 'Applications supplied',
            collapsible: true,
            items: [
              {
                kind: 'query',
                queryText: '<-"Contract".vendor.<-"System Contract"',
                label: 'Applications supplied'
              }
            ]
          },
          {
            id: 'technology-lifecycle',
            title: 'Technology lifecycle',
            collapsible: true,
            items: [
              {
                kind: 'query',
                queryText: '<-"Contract".vendor.<-"System Contract"',
                label: 'Technology lifecycle',
                presentation: 'list',
                fields: [{ fieldId: '_lifecycle', label: 'Lifecycle' }]
              }
            ]
          },
          {
            id: 'capabilities-funded',
            title: 'Capabilities funded',
            collapsible: true,
            items: [
              {
                kind: 'placeholder',
                message: VENDOR_CAPABILITIES_FUNDED_PLACEHOLDER_MESSAGE
              }
            ]
          }
        ]
      },
      contract: {
        header: {
          badges: [{ kind: 'field', fieldId: 'contract_type', showLabel: false }]
        },
        sections: [
          {
            id: 'vendor',
            title: 'Vendor',
            collapsible: false,
            items: [{ kind: 'relation', fieldId: 'vendor', label: 'Provided by' }]
          },
          {
            id: 'terms',
            title: 'Terms',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'contract_start' },
              { kind: 'field', fieldId: 'contract_end' },
              { kind: 'field', fieldId: 'contract_type' },
              { kind: 'field', fieldId: 'notice_period' },
              { kind: 'field', fieldId: 'auto_renew' },
              { kind: 'field', fieldId: 'contract_owner' }
            ]
          },
          {
            id: 'cost',
            title: 'Cost',
            collapsible: false,
            layout: 'stat-grid',
            items: [
              { kind: 'field', fieldId: 'annual_cost', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'setup_fee', presentation: 'mini-panel' }
            ]
          },
          {
            id: 'systems-used',
            title: 'Systems used',
            collapsible: true,
            items: [
              {
                kind: 'typed-relation-list',
                fieldId: 'system',
                label: 'Systems used',
                showLabel: false
              }
            ]
          }
        ]
      }
    }
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
            description: 'The domain this system belongs to.',
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
          {
            id: 'api_type',
            name: 'Type',
            description: 'The style of API, such as REST, GraphQL or event stream.',
            type: 'select',
            enumId: 'api-type'
          },
          {
            id: 'system',
            name: 'System',
            description: 'The system that owns this API.',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'system',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'api_version',
            name: 'API Version',
            description: 'The version identifier of the API.',
            type: 'text'
          },
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
          {
            id: 'kind',
            name: 'Kind',
            description: 'The type of component, such as service, library or website.',
            type: 'select',
            enumId: 'component-kind'
          },
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology or framework the component is built with.',
            type: 'text'
          },
          {
            id: 'go_live_date',
            name: 'Go Live Date',
            description: 'The date the component entered production.',
            type: 'date'
          },
          {
            id: 'system',
            name: 'System',
            description: 'The system this component is part of.',
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
          {
            id: 'kind',
            name: 'Kind',
            description: 'The kind of resource, such as database, queue or storage bucket.',
            type: 'select',
            enumId: 'resource-kind'
          },
          {
            id: 'planned_decommission',
            name: 'Planned Decommission',
            description: 'The date the resource is planned to be shut down.',
            type: 'date'
          },
          {
            id: 'system',
            name: 'System',
            description: 'The system this resource belongs to.',
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
        fields: [
          {
            id: 'description',
            name: 'Description',
            description: 'A short summary of who this person or role is and what they do.',
            type: 'longtext'
          }
        ]
      },
      {
        symId: 'software_system',
        name: 'Software System',
        description: 'The highest level of abstraction — something that delivers value to users.',
        category: 'Architecture',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [
          {
            id: 'description',
            name: 'Description',
            description: 'A short summary of what the software system does.',
            type: 'longtext'
          }
        ]
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology the container is built with.',
            type: 'text'
          },
          {
            id: 'description',
            name: 'Description',
            description: 'A short summary of what the container does.',
            type: 'longtext'
          },
          {
            id: 'system',
            name: 'Software System',
            description: 'The software system this container is part of.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology or framework the component is built with.',
            type: 'text'
          },
          {
            id: 'container',
            name: 'Container',
            description: 'The container this component runs in.',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'container',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            description: 'Other components this component needs in order to work.',
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
            description: 'The organization that provides this service.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology the application is built with.',
            type: 'text'
          },
          {
            id: 'tier',
            name: 'Tier',
            description:
              'How critical the application is, which sets its support and recovery expectations.',
            type: 'select',
            enumId: 'application-tier'
          },
          {
            id: 'sunset_date',
            name: 'Sunset Date',
            description: 'The date the application is planned to be retired.',
            type: 'date'
          },
          {
            id: 'service',
            name: 'Business Service',
            description: 'The business service this application supports.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The database product or engine in use.',
            type: 'text'
          },
          {
            id: 'application',
            name: 'Application',
            description: 'The application that uses this database.',
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
          {
            id: 'host_type',
            name: 'Type',
            description:
              'The kind of host, such as physical server, virtual machine or container host.',
            type: 'select',
            enumId: 'host-type'
          },
          {
            id: 'environment',
            name: 'Environment',
            description: 'The environment the host belongs to, such as production or test.',
            type: 'select',
            enumId: 'environment'
          },
          {
            id: 'patch_deadline',
            name: 'Patch Deadline',
            description: 'The date by which the host must have its pending patches applied.',
            type: 'date'
          },
          {
            id: 'applications',
            name: 'Applications',
            description: 'Applications running on this host.',
            type: 'reference',
            symSchemaId: 'application',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'databases',
            name: 'Databases',
            description: 'Databases running on this host.',
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
          {
            id: 'kind',
            name: 'Kind',
            description: 'The type of service.',
            type: 'select',
            enumId: 'service-kind'
          },
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology the service is built with.',
            type: 'text'
          },
          {
            id: 'domain',
            name: 'Domain',
            description: 'The domain this service belongs to.',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'depends_on',
            name: 'Depends On',
            description: 'Other services this service needs in order to work.',
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
          {
            id: 'event_type',
            name: 'Type',
            description: 'The kind of event, such as domain event, integration event or command.',
            type: 'select',
            enumId: 'event-type'
          },
          {
            id: 'producer',
            name: 'Producer',
            description: 'The service that publishes this event.',
            type: 'reference',
            symSchemaId: 'service',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'consumers',
            name: 'Consumers',
            description: 'The services that react to this event.',
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
          {
            id: 'team_type',
            name: 'Type',
            description:
              'The Team Topologies type of the team, such as stream-aligned or platform.',
            type: 'select',
            enumId: 'team-type'
          },
          {
            id: 'cognitive_load',
            name: 'Cognitive Load Notes',
            description: 'Notes on how much the team is asked to handle and where it is stretched.',
            type: 'longtext'
          }
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
            description: 'The team that owns and is accountable for this system.',
            type: 'containment',
            symSchemaId: 'team',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'description',
            name: 'Description',
            description: 'A short summary of what the system does.',
            type: 'longtext'
          }
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
          {
            id: 'mode',
            name: 'Mode',
            description:
              'The interaction mode between the teams: collaboration, X-as-a-service or facilitating.',
            type: 'select',
            enumId: 'interaction-mode'
          },
          {
            id: 'from_team',
            name: 'From Team',
            description: 'The team that initiates the interaction.',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'to_team',
            name: 'To Team',
            description: 'The team the interaction is directed at.',
            type: 'reference',
            symSchemaId: 'team',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'expected_duration',
            name: 'Expected Duration',
            description: 'How long the interaction is expected to last.',
            type: 'duration'
          }
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology the source system is built with.',
            type: 'text'
          },
          {
            id: 'domain',
            name: 'Domain',
            description: 'The business domain that owns this source system.',
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
          {
            id: 'dp_type',
            name: 'Type',
            description:
              'The kind of data product, such as source-aligned, aggregate or consumer-aligned.',
            type: 'select',
            enumId: 'data-product-type'
          },
          {
            id: 'slo',
            name: 'SLOs',
            description:
              'The service level objectives the data product commits to, such as freshness and availability.',
            type: 'longtext'
          },
          {
            id: 'review_date',
            name: 'Review Date',
            description: 'The date the data product is next due to be reviewed.',
            type: 'date'
          },
          {
            id: 'domain',
            name: 'Domain',
            description: 'The business domain that owns this data product.',
            type: 'containment',
            symSchemaId: 'domain',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'source_systems',
            name: 'Source Systems',
            description: 'The systems this data product gets its data from.',
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
          {
            id: 'format',
            name: 'Format',
            description: 'The file or storage format of the dataset, such as Parquet or CSV.',
            type: 'select',
            enumId: 'dataset-format'
          },
          {
            id: 'schema_url',
            name: 'Schema URL',
            description: "A link to the schema that describes the dataset's structure.",
            type: 'text'
          },
          {
            id: 'deprecation_date',
            name: 'Deprecation Date',
            description: 'The date the dataset is scheduled to be withdrawn.',
            type: 'date'
          },
          {
            id: 'data_product',
            name: 'Data Product',
            description: 'The data product this dataset is published as part of.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The tool or framework the pipeline runs on.',
            type: 'text'
          },
          {
            id: 'inputs',
            name: 'Inputs',
            description: 'The datasets or systems the pipeline reads from.',
            type: 'reference',
            symSchemaId: 'dataset',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'outputs',
            name: 'Outputs',
            description: 'The datasets the pipeline writes to.',
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
            description: 'The broader capability this capability is a part of.',
            type: 'containment',
            symSchemaId: 'business_capability',
            minCount: 0,
            maxCount: 1
          },
          {
            id: 'target_date',
            name: 'Target Date',
            description: 'The date by which the capability is planned to reach its target state.',
            type: 'date'
          }
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
            description: 'The business capability this process realizes.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The main technology the application component is built with.',
            type: 'text'
          },
          {
            id: 'layer',
            name: 'Layer',
            description: 'The architectural layer the component sits in.',
            type: 'select',
            enumId: 'layer'
          },
          {
            id: 'retirement_date',
            name: 'Retirement Date',
            description: 'The date the component is planned to be retired.',
            type: 'date'
          },
          {
            id: 'realises',
            name: 'Realises Process',
            description: 'The business processes this component supports.',
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
            description: 'The application component that provides this service.',
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
          {
            id: 'technology',
            name: 'Technology',
            description: 'The product or platform used.',
            type: 'text'
          },
          {
            id: 'kind',
            name: 'Kind',
            description:
              'The kind of technology component, such as node, device or system software.',
            type: 'select',
            enumId: 'technology-kind'
          },
          {
            id: 'end_of_support',
            name: 'End of Support',
            description: 'The date vendor support for this component ends.',
            type: 'date'
          },
          {
            id: 'hosts',
            name: 'Hosts',
            description: 'The application components that run on this technology component.',
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
            description: 'The sensitivity level of the asset, which sets how it must be protected.',
            type: 'select',
            enumId: 'classification'
          },
          {
            id: 'asset_type',
            name: 'Type',
            description: 'The kind of asset, such as data, system or facility.',
            type: 'select',
            enumId: 'asset-type'
          }
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
            description:
              'The STRIDE category of the threat: spoofing, tampering, repudiation, information disclosure, denial of service or elevation of privilege.',
            type: 'select',
            enumId: 'stride-category'
          },
          {
            id: 'discovered_on',
            name: 'Discovered On',
            description: 'The date the threat was identified.',
            type: 'date'
          },
          {
            id: 'affected_assets',
            name: 'Affected Assets',
            description: 'The assets this threat could harm.',
            type: 'reference',
            symSchemaId: 'asset',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'description',
            name: 'Description',
            description:
              'A description of how the threat could materialize and what it would affect.',
            type: 'longtext'
          }
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
          {
            id: 'control_type',
            name: 'Type',
            description: 'The kind of control, such as preventive, detective or corrective.',
            type: 'select',
            enumId: 'control-type'
          },
          {
            id: 'last_verified',
            name: 'Last Verified',
            description: 'The date the control was last checked to be in place and working.',
            type: 'date'
          },
          {
            id: 'mitigates',
            name: 'Mitigates',
            description: 'The risks or threats this control reduces.',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'protects',
            name: 'Protects',
            description: 'The assets this control protects.',
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
          {
            id: 'likelihood',
            name: 'Likelihood',
            description: 'How likely the risk is to occur.',
            type: 'select',
            enumId: 'likelihood'
          },
          {
            id: 'impact',
            name: 'Impact',
            description: 'How severe the consequences would be if the risk occurs.',
            type: 'select',
            enumId: 'impact'
          },
          {
            id: 'review_due',
            name: 'Review Due',
            description: 'The date the risk is next due to be reviewed.',
            type: 'date'
          },
          {
            id: 'threat',
            name: 'Threat',
            description: 'The threat this risk stems from.',
            type: 'reference',
            symSchemaId: 'threat',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'controls',
            name: 'Controls',
            description: 'The controls in place to reduce this risk.',
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
          {
            id: 'likelihood',
            name: 'Likelihood',
            description: 'How likely the risk is to occur, from 1 (rare) to 5 (almost certain).',
            type: 'number',
            min: 1,
            max: 5
          },
          {
            id: 'impact',
            name: 'Impact',
            description:
              'How severe the consequences would be if the risk occurs, from 1 (minor) to 5 (severe).',
            type: 'number',
            min: 1,
            max: 5
          },
          {
            id: 'category',
            name: 'Category',
            description: 'The type of risk, such as operational, financial or security.',
            type: 'select',
            enumId: 'risk-category'
          },
          {
            id: 'inherent_risk_score',
            name: 'Inherent Risk Score',
            description:
              'Calculated: likelihood multiplied by impact, before any controls are applied.',
            type: 'derived',
            expression: 'entity.likelihood * entity.impact',
            resultType: 'number'
          },
          {
            id: 'mitigation_effectiveness',
            name: 'Mitigation Effectiveness',
            description: 'How much the existing mitigations reduce the impact of the risk.',
            type: 'select',
            enumId: 'risk-mitigation-effectiveness'
          },
          {
            id: 'residual_risk_score',
            name: 'Residual Risk Score',
            description:
              'Calculated: the risk score remaining after taking mitigation into account.',
            type: 'derived',
            expression:
              "entity.likelihood * (entity.mitigation_effectiveness == 'full' ? 0 : entity.mitigation_effectiveness == 'substantial' ? (entity.impact - 2 < 1 ? 1 : entity.impact - 2) : entity.mitigation_effectiveness == 'partial' ? (entity.impact - 1 < 1 ? 1 : entity.impact - 1) : entity.impact)",
            resultType: 'number'
          },
          {
            id: 'risk_coverage',
            name: 'Risk Coverage',
            description:
              'Calculated: the combined percentage of the risk covered by its mitigating controls.',
            type: 'derived',
            expression:
              "entity.mitigating_controls.filter(.coverage != null && (.effectiveness == 'none' || .effectiveness == 'partial' || .effectiveness == 'substantial' || .effectiveness == 'full')).count() == 0 ? null : round(entity.mitigating_controls.filter(.coverage != null && (.effectiveness == 'none' || .effectiveness == 'partial' || .effectiveness == 'substantial' || .effectiveness == 'full')).map(.coverage * (.effectiveness == 'none' ? 0 : .effectiveness == 'partial' ? 0.5 : .effectiveness == 'substantial' ? 0.75 : 1) / -100 + 1).product() * -100 + 100)",
            resultType: 'number'
          },
          {
            id: 'risk_owner',
            name: 'Risk Owner',
            description: 'The person accountable for managing this risk.',
            type: 'text'
          },
          {
            id: 'status',
            name: 'Status',
            description:
              'Where the risk is in its handling, for example open, mitigated or accepted.',
            type: 'select',
            enumId: 'risk-status'
          },
          {
            id: 'treatment_target_date',
            name: 'Treatment Target Date',
            description: 'The date by which the chosen treatment of the risk should be in place.',
            type: 'date'
          },
          {
            id: 'affected_entities',
            name: 'Affects',
            description: 'The entities that would be affected if the risk occurs.',
            type: 'typedRelation',
            symRelationSchemaId: 'risk-affects',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'mitigating_controls',
            name: 'Mitigated by',
            description: 'The controls that mitigate this risk.',
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
          {
            id: 'control_type',
            name: 'Type',
            description: 'The kind of control, such as preventive, detective or corrective.',
            type: 'select',
            enumId: 'rc-control-type'
          },
          {
            id: 'design_effectiveness',
            name: 'Design Effectiveness',
            description: 'How well the control is designed to achieve its objective.',
            type: 'select',
            enumId: 'control-effectiveness'
          },
          {
            id: 'operating_effectiveness',
            name: 'Operating Effectiveness',
            description: 'How well the control works in practice.',
            type: 'select',
            enumId: 'control-effectiveness'
          },
          {
            id: 'last_verified',
            name: 'Last Verified',
            description: 'The date the control was last checked to be in place and working.',
            type: 'date'
          },
          {
            id: 'mitigated_risks',
            name: 'Mitigates',
            description: 'The risks this control helps mitigate.',
            type: 'typedRelation',
            symRelationSchemaId: 'risk-control',
            direction: 'out',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'satisfied_requirements',
            name: 'Satisfies',
            description: 'The compliance requirements this control satisfies.',
            type: 'typedRelation',
            symRelationSchemaId: 'control-requirement',
            direction: 'in',
            minCount: 0,
            maxCount: -1
          }
          // 'protected_entities' is added by the 'control-protection' composition extension below
          // (only when 'information-governance' is also selected) — see its `schemaFields`.
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
          {
            id: 'framework_kind',
            name: 'Kind',
            description: 'The kind of framework, such as regulation, standard or internal policy.',
            type: 'select',
            enumId: 'framework-kind'
          },
          {
            id: 'description',
            name: 'Description',
            description: 'A short summary of what this is and why it matters.',
            type: 'longtext'
          }
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
          {
            id: 'requirement_code',
            name: 'Requirement Code',
            description: 'The identifier of the requirement within its framework, such as A.5.1.',
            type: 'text'
          },
          {
            id: 'status',
            name: 'Status',
            description: 'How far the requirement has been met.',
            type: 'select',
            enumId: 'requirement-status'
          },
          {
            id: 'framework',
            name: 'Framework',
            description: 'The framework this requirement comes from.',
            predicate: 'belongs to',
            type: 'containment',
            symSchemaId: 'framework',
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'satisfying_controls',
            name: 'Satisfied by',
            description: 'The controls that satisfy this requirement.',
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
            description: 'How well the control reduces this risk.',
            type: 'select',
            enumId: 'risk-mitigation-effectiveness',
            requirementLevel: 'required'
          },
          {
            id: 'coverage',
            name: 'Coverage',
            description: 'The percentage of the risk the control is expected to cover.',
            type: 'number',
            min: 0,
            max: 100,
            requirementLevel: 'required'
          },
          {
            id: 'reviewed_on',
            name: 'Reviewed On',
            description: 'The date the link between risk and control was last reviewed.',
            type: 'date'
          }
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
            description: 'How far the control has been shown to satisfy the requirement.',
            type: 'select',
            enumId: 'requirement-status',
            requirementLevel: 'required'
          },
          {
            id: 'evidence',
            name: 'Evidence',
            description:
              'Where the evidence that the control satisfies the requirement can be found.',
            type: 'text'
          },
          {
            id: 'verified_on',
            name: 'Verified On',
            description: 'The date the evidence was last verified.',
            type: 'date'
          }
        ],
        color: AR_COLOR_GREEN,
        icon: 'check-circle'
      },
      {
        symId: 'risk-affects',
        name: 'Risk Affects',
        description: 'Associates a Risk with any entity affected by it.',
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
      ...GENERIC_STARTER_DASHBOARD_WIDGETS,
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
        y: 8,
        w: 4,
        h: 8
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
        y: 8,
        w: 4,
        h: 8
      },
      {
        id: 'overdue-risk-control-reviews',
        type: 'Assessments',
        config: { mode: 'overdue', label: 'Overdue risk and control reviews' },
        x: 8,
        y: 8,
        w: 4,
        h: 8
      },
      {
        id: 'risks-outside-appetite',
        type: 'AggregateStat',
        config: {
          query: 'schema:Risk AND status != "closed" AND residual_risk_score >= 10',
          label: 'Risks outside appetite',
          subtextTemplate: 'open, high or critical residual risk',
          severity: { warnAt: 1 }
        },
        x: 0,
        y: 16,
        w: 6,
        h: 8
      },
      {
        id: 'control-coverage',
        type: 'AggregateStat',
        config: {
          query: 'schema:Control AND operating_effectiveness = "effective"',
          denominatorQuery: 'schema:Control',
          display: 'percent',
          label: 'Control coverage',
          subtextTemplate: '{count} of {total} tested effective',
          severity: { warnAt: 80, critAt: 50, direction: 'below' }
        },
        x: 6,
        y: 16,
        w: 6,
        h: 8
      },
      { id: 'default-activity-feed', type: 'activity-feed', config: {}, x: 0, y: 24, w: 12, h: 24 }
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
      },
      {
        id: 'risk-compliance-control-coverage-traceability',
        name: 'Control Coverage',
        description:
          'Controls with the Risks they mitigate and the entities they protect, including information assets.',
        viewMode: 'traceability',
        filters: {
          schemaId: 'control',
          root: { kind: 'and', children: [] }
        },
        config: {
          traceability: {
            paths: [
              {
                id: 'mitigated-risks',
                label: 'Mitigated risks',
                path: [
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'risk-control',
                    direction: 'out'
                  }
                ],
                targetSchemaIds: ['risk']
              },
              {
                id: 'protected-entities',
                label: 'Protected entities',
                path: [
                  {
                    kind: 'unboundTypedRelation',
                    relationSchemaId: 'control-affects',
                    direction: 'in'
                  }
                ],
                targetSchemaIds: 'any'
              }
            ],
            showOrphanEntities: true
          }
        }
      }
    ],
    entityDrawerProfiles: {
      risk: {
        header: {
          badges: [
            { kind: 'field', fieldId: 'category', showLabel: false },
            { kind: 'field', fieldId: 'status', showLabel: false }
          ]
        },
        sections: [
          {
            id: 'risk-profile',
            title: 'Risk profile',
            collapsible: false,
            layout: 'stat-grid',
            items: [
              { kind: 'field', fieldId: 'likelihood', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'impact', presentation: 'mini-panel' },
              { kind: 'field', fieldId: 'inherent_risk_score', presentation: 'mini-panel' },
              {
                kind: 'field',
                fieldId: 'mitigation_effectiveness',
                presentation: 'mini-panel'
              },
              { kind: 'field', fieldId: 'residual_risk_score', presentation: 'mini-panel' }
            ]
          },
          {
            id: 'attributes',
            title: 'Attributes',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'category' },
              { kind: 'field', fieldId: 'status' },
              { kind: 'field', fieldId: 'risk_owner' },
              { kind: 'field', fieldId: 'treatment_target_date' }
            ]
          },
          {
            id: 'coverage',
            title: 'Coverage',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'risk_coverage', presentation: 'mini-panel' },
              {
                kind: 'typed-relation-list',
                fieldId: 'mitigating_controls',
                label: 'Mitigating controls',
                showLabel: false,
                attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness' }]
              }
            ]
          },
          {
            id: 'affected-entities',
            title: 'Affected entities',
            collapsible: false,
            items: [
              {
                kind: 'typed-relation-list',
                fieldId: 'affected_entities',
                label: 'Affected entities',
                showLabel: false
              }
            ]
          }
        ]
      },
      control: {
        header: {
          badges: [{ kind: 'field', fieldId: 'control_type', showLabel: false }]
        },
        sections: [
          {
            id: 'attributes',
            title: 'Attributes',
            collapsible: false,
            items: [
              { kind: 'field', fieldId: 'control_type' },
              { kind: 'field', fieldId: 'design_effectiveness' },
              { kind: 'field', fieldId: 'operating_effectiveness' },
              { kind: 'field', fieldId: 'last_verified' }
            ]
          },
          {
            id: 'application-content',
            title: 'Additional attributes',
            collapsible: true,
            items: [
              {
                kind: 'typed-relation-list',
                fieldId: 'mitigated_risks',
                label: 'Risks mitigated',
                attributes: [{ fieldId: 'coverage' }, { fieldId: 'effectiveness' }]
              },
              {
                kind: 'typed-relation-list',
                fieldId: 'protected_entities',
                label: 'Protected entities'
              }
            ]
          }
        ]
      }
    },
    // Control Protection (`control-affects`) only exists when 'information-governance' is also
    // selected, since it points specifically at that template's Data Entity schema — everything
    // else in Risk & Compliance (Risk register, Control library, mitigation, compliance
    // frameworks) stays fully usable on its own. Mirrors 'information-governance'-own 'data-flow'
    // composition extension's `system` dependency (same file, `dataFlowRelationSchema`) — same
    // shape, but requiring a *named sibling template* rather than any 'full'-category one.
    compositionExtensions: [
      {
        id: 'control-protection',
        requiredTemplateIds: ['information-governance'],
        dependencies: [
          {
            id: 'data-entity',
            name: 'Data Entity schema',
            description: 'The schema representing an information asset a Control can protect.',
            kind: 'schema',
            minTargets: 1,
            maxTargets: 1
          }
        ],
        relationSchemas: [
          {
            symId: 'control-affects',
            name: 'Control Protection',
            description: 'Associates a Control with the Data Entity it protects.',
            category: 'Governance',
            inLabel: 'Protects Data Entity',
            outLabel: 'Protected by Control',
            inSymSchemaIds: [{ templateId: 'risk-compliance', symId: 'control' }],
            outSymSchemaIds: [{ dependencyId: 'data-entity' }],
            fields: [],
            color: AR_COLOR_GREEN,
            icon: 'shield-check'
          }
        ],
        schemaFields: [
          {
            target: { templateId: 'risk-compliance', symId: 'control' },
            fields: [
              {
                id: 'protected_entities',
                name: 'Protects',
                description: 'The entities this control protects.',
                type: 'typedRelation',
                symRelationSchemaId: {
                  templateId: controlProtectionExtensionTemplateId,
                  symId: 'control-affects'
                },
                direction: 'in',
                minCount: 0,
                maxCount: -1
              }
            ]
          },
          {
            target: { dependencyId: 'data-entity' },
            fields: [
              {
                id: 'protecting_controls',
                name: 'Protected by',
                description: 'The controls that protect this entity.',
                type: 'typedRelation',
                symRelationSchemaId: {
                  templateId: controlProtectionExtensionTemplateId,
                  symId: 'control-affects'
                },
                direction: 'out',
                minCount: 0,
                maxCount: -1
              }
            ]
          }
        ]
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
    enums: [
      strategyStatusEnum,
      strategyMeasureDirectionEnum,
      capabilityTypeEnum,
      capabilityHealthEnum,
      strategicImportanceEnum,
      investmentPriorityEnum,
      capabilityReferenceModelEnum
    ],
    relationSchemas: strategyRelationSchemas,
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates,
    entityDrawerProfiles: {
      business_capability: {
        header: {
          badges: [
            { kind: 'field', fieldId: 'capability_level', showLabel: false },
            { kind: 'metadata', slot: 'lifecycle' }
          ]
        },
        sections: [
          {
            id: 'strategy-assessment',
            title: 'Strategy assessment',
            collapsible: false,
            items: [
              { kind: 'rollup', fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' },
              {
                kind: 'rollup',
                fieldId: 'maturity_target',
                aggregation: 'avg',
                format: 'decimal1'
              },
              {
                kind: 'rollup',
                fieldId: 'annual_investment',
                aggregation: 'sum',
                format: 'currency'
              },
              { kind: 'rollup', fieldId: 'risk', aggregation: 'avg', format: 'decimal1' },
              { kind: 'rollup-leaf-count' },
              { kind: 'field', fieldId: 'capability_type' },
              { kind: 'field', fieldId: 'value_stream' },
              { kind: 'field', fieldId: 'maturity' },
              { kind: 'field', fieldId: 'maturity_target' },
              { kind: 'field', fieldId: 'strategic_importance' },
              { kind: 'field', fieldId: 'investment_priority' }
            ]
          },
          {
            id: 'application-content',
            title: 'Additional attributes',
            collapsible: true,
            items: [
              { kind: 'metadata', slot: 'owner' },
              {
                kind: 'children',
                childSchemaId: 'business_capability',
                fieldId: 'parent',
                label: 'Children'
              },
              {
                kind: 'query',
                queryText: 'subtree(parent).->"Business Capability Supports Entity"',
                label: 'Realized by'
              },
              {
                kind: 'query',
                queryText: '<-"Objective Supports Business Capability"',
                label: 'Linked objectives'
              },
              {
                kind: 'query',
                queryText: '<-"Objective Supports Business Capability".<-"Initiative".objectives',
                label: 'Linked initiatives'
              }
            ]
          }
        ]
      }
    },
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
    case 'containmentSubtree':
      return {
        ...step,
        ownerSchemaId: idMap.get(step.ownerSchemaId) ?? step.ownerSchemaId,
        ...(step.filter && {
          filter: resolveEntityQueryNodeSchemaIds(step.filter, idMap, relationSchemaIdMap)
        })
      };
    case 'endpoint':
    case 'relationSubtree':
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
    case 'relation-matrix':
      return {
        ...config,
        ...(typeof config.colSchemaId === 'string' && {
          colSchemaId: idMap.get(config.colSchemaId) ?? config.colSchemaId
        })
      };
    case 'nested-map': {
      const resolved: Record<string, unknown> = { ...config };
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
    case 'relation-columns':
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
  for (const mode of [
    'radar',
    'relation-matrix',
    'nested-map',
    'relation-columns',
    'graph',
    'traceability'
  ]) {
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
  /** Authored drawer profiles keyed by materialized schema id. */
  entityDrawerProfiles: Record<string, EntityDrawerProfile>;
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
  entityDrawerProfiles: {},
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
    const resolved = resolveFieldInner(ownerId, field);
    return {
      ...resolved,
      ...(field.description ? { description: field.description } : {}),
      ...(field.groupId ? { groupId: field.groupId } : {})
    };
  };

  const resolveFieldInner = (ownerId: string, field: SymbolicField): SchemaField => {
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
            : undefined,
        recalc_interval: field.recalcInterval
      };
    }
    if (field.type === 'duration') {
      return {
        id: field.id,
        name: field.name,
        type: 'duration',
        minCardinality: field.minCardinality,
        maxCardinality: field.maxCardinality,
        requirementLevel: field.requirementLevel
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
  ): RelationField => {
    const resolved = resolveRelationFieldInner(ownerId, field);
    return field.description ? { ...resolved, description: field.description } : resolved;
  };

  const resolveRelationFieldInner = (
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
        groups: (source.groups ?? []).map(group => ({
          id: group.id,
          name: group.name,
          ...(group.description ? { description: group.description } : {})
        })),
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
        unique_endpoint_pair: relationSchema.uniqueEndpointPair ?? false,
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
    const entityDrawerProfiles = remapEntityDrawerProfiles(
      fragment.template.entityDrawerProfiles ?? {},
      schemaIds,
      relationSchemaIds
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
      entityDrawerProfiles,
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
    Object.assign(result.entityDrawerProfiles, module.entityDrawerProfiles);
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
