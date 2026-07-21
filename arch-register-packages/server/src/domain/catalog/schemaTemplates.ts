import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED
} from '@arch-register/api-types/colors';
import { randomUUID } from 'node:crypto';
import type { SchemaDbCreate, WorkspaceEnumDbCreate } from '../../db/database';
import type { DocumentField, DocumentMetadata } from '@arch-register/api-types/documentContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type {
  DocumentTemplateDbCreate,
  DocumentTypeDbCreate
} from '../document/db/documentDatabase';
import { normalizePublicIdPrefix } from '../../utils/publicIds';

export type SymbolicField =
  | { id: string; name: string; type: 'text' | 'longtext' | 'boolean' | 'date' }
  | { id: string; name: string; type: 'select'; enumId: string }
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
    };

export type TemplateSchema = {
  symId: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  fields: SymbolicField[];
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

export type SchemaTemplate = {
  id: string;
  name: string;
  description: string;
  schemas: TemplateSchema[];
  enums: SymbolicEnum[];
  documentTypes: SymbolicDocumentType[];
  documentTemplates: SymbolicDocumentTemplate[];
};

const enumDefinition = (
  id: string,
  name: string,
  options: Array<{ value: string; label: string }>
): SymbolicEnum => ({ id, name, options });

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

const technologyReleaseSchema: TemplateSchema = {
  symId: 'technology_release',
  name: 'Technology Release',
  description:
    'A product release cycle tracked for support lifecycle, technology radar governance, and planning.',
  color: AR_COLOR_BLUE,
  icon: 'cpu',
  fields: [
    { id: 'product', name: 'Product', type: 'text' },
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

export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: 'default',
    name: 'Default',
    description:
      'Diagram Craft default catalog — Domain, System, Component, API, Resource, and Technology Release.',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A high-level grouping that owns one or more Systems.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'system',
        name: 'System',
        description:
          'A collection of resources that exposes one or more APIs to users and other Systems.',
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
          }
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A deployable unit of code within a System (service, library, website, etc.).',
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
          {
            id: 'provides_apis',
            name: 'Provided APIs',
            predicate: 'provides',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'consumes_apis',
            name: 'Consumed APIs',
            predicate: 'consumes',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
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
      },
      {
        symId: 'api',
        name: 'API',
        description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
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
          }
        ]
      },
      {
        symId: 'resource',
        name: 'Resource',
        description:
          'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
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
      technologyReleaseSchema
    ],
    enums: [backstageEnums[0]!, ...technologyEnums],
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates
  },
  {
    id: 'backstage',
    name: 'Backstage',
    description: 'CNCF Backstage Software Catalog — Domain, System, Component, API, Resource',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A high-level grouping that owns one or more Systems.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'system',
        name: 'System',
        description:
          'A collection of resources that exposes one or more APIs to users and other Systems.',
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
          }
        ]
      },
      {
        symId: 'api',
        name: 'API',
        description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
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
          }
        ]
      },
      {
        symId: 'component',
        name: 'Component',
        description: 'A deployable unit of code within a System (service, library, website, etc.).',
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
            minCount: 1,
            maxCount: 1
          },
          {
            id: 'provides_apis',
            name: 'Provided APIs',
            predicate: 'provides',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
          },
          {
            id: 'consumes_apis',
            name: 'Consumed APIs',
            predicate: 'consumes',
            type: 'reference',
            symSchemaId: 'api',
            minCount: 0,
            maxCount: -1
          }
        ]
      },
      {
        symId: 'resource',
        name: 'Resource',
        description:
          'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
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
    documentTypes: commonDocumentTypes,
    documentTemplates: commonDocumentTemplates
  },
  {
    id: 'c4',
    name: 'C4 Model',
    description: 'C4 Model by Simon Brown — Person, Software System, Container, Component',
    schemas: [
      {
        symId: 'person',
        name: 'Person',
        description: 'A user or actor that interacts with one or more Software Systems.',
        color: AR_COLOR_YELLOW,
        icon: 'user',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'software_system',
        name: 'Software System',
        description: 'The highest level of abstraction — something that delivers value to users.',
        color: AR_COLOR_PURPLE,
        icon: 'layers',
        fields: [{ id: 'description', name: 'Description', type: 'longtext' }]
      },
      {
        symId: 'container',
        name: 'Container',
        description:
          'A separately deployable/runnable unit within a Software System (app, service, DB, etc.).',
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
    name: 'CMDB / ITIL',
    description:
      'IT Service Management — Organization, Business Service, Application, Database, Host',
    schemas: [
      {
        symId: 'organization',
        name: 'Organization',
        description: 'A business unit or department that owns one or more Business Services.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'business_service',
        name: 'Business Service',
        description:
          'An IT-enabled capability delivered to the business by one or more Applications.',
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
    name: 'Domain-Driven',
    description: 'Simple DDD-inspired model — Domain, Team, Service, Event',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A bounded context representing a distinct area of business knowledge.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'team',
        name: 'Team',
        description: 'An engineering team that owns one or more Services.',
        color: AR_COLOR_ORANGE,
        icon: 'users',
        fields: []
      },
      {
        symId: 'service',
        name: 'Service',
        description: 'A deployable unit that implements domain logic within a bounded context.',
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
    name: 'Team Topologies',
    description: "Conway's Law model — Team, System, API (interaction modes)",
    schemas: [
      {
        symId: 'team',
        name: 'Team',
        description:
          'An engineering team classified by its topology type (stream-aligned, platform, enabling, complicated-subsystem).',
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
    name: 'Data Mesh',
    description:
      'Data Mesh by Zhamak Dehghani — Domain, Data Product, Dataset, Pipeline, Source System',
    schemas: [
      {
        symId: 'domain',
        name: 'Domain',
        description: 'A business domain that owns one or more Data Products.',
        color: AR_COLOR_YELLOW,
        icon: 'globe',
        fields: []
      },
      {
        symId: 'source_system',
        name: 'Source System',
        description: 'An operational system that produces raw data consumed by Data Products.',
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
    name: 'ArchiMate / TOGAF',
    description: 'The Open Group EA framework — Business, Application, and Technology layers',
    schemas: [
      {
        symId: 'business_capability',
        name: 'Business Capability',
        description: 'A high-level ability the organisation needs to execute its strategy.',
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
    name: 'Security / Threat Model',
    description: 'STRIDE-adjacent model — Asset, Control, Threat, Risk',
    schemas: [
      {
        symId: 'asset',
        name: 'Asset',
        description:
          'A data, service, infrastructure, or credential item that requires protection.',
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
  }
];

export type InstantiatedTemplate = {
  schemas: SchemaDbCreate[];
  enums: WorkspaceEnumDbCreate[];
  documentTypes: DocumentTypeDbCreate[];
  documentTemplates: DocumentTemplateDbCreate[];
};

export const instantiateTemplateDefinitions = (
  workspaceId: string,
  templateId: string,
  now = new Date()
): InstantiatedTemplate => {
  const template = SCHEMA_TEMPLATES.find(t => t.id === templateId);
  if (!template) {
    return { schemas: [], enums: [], documentTypes: [], documentTemplates: [] };
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

  const schemas = template.schemas.map(schema => {
    const resolvedFields: SchemaField[] = schema.fields.map(field => {
      if (field.type === 'reference') {
        const resolvedId = idMap.get(field.symSchemaId) ?? field.symSchemaId;
        return {
          id: field.id,
          name: field.name,
          predicate: field.predicate,
          type: 'reference',
          schemaId: resolvedId,
          minCount: field.minCount,
          maxCount: field.maxCount
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
          maxCount: field.maxCount
        };
      }
      if (field.type === 'select') {
        return {
          id: field.id,
          name: field.name,
          type: field.type,
          enumId: enumIdMap.get(field.enumId) ?? field.enumId
        };
      }
      if (field.type === 'text') {
        return { id: field.id, name: field.name, type: 'text' };
      }
      if (field.type === 'longtext') {
        return { id: field.id, name: field.name, type: 'longtext' };
      }
      if (field.type === 'boolean') {
        return { id: field.id, name: field.name, type: 'boolean' };
      }
      return { id: field.id, name: field.name, type: 'date' };
    });

    return {
      id: idMap.get(schema.symId)!,
      workspace: workspaceId,
      name: schema.name,
      description: schema.description,
      key_prefix: normalizePublicIdPrefix(
        schema.symId.replace(/[^a-z]/gi, '').slice(0, 5) ?? schema.name.slice(0, 5)
      ),
      color: schema.color,
      icon: schema.icon,
      fields: resolvedFields,
      default_owner: null,
      created_at: now,
      updated_at: now
    };
  });

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

  return { schemas, enums, documentTypes, documentTemplates };
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
