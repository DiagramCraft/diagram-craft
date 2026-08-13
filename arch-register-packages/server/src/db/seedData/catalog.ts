import {
  AR_COLOR_BLUE,
  AR_COLOR_CYAN,
  AR_COLOR_GREEN,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_RED,
  AR_COLOR_TEAL,
  AR_COLOR_YELLOW
} from '@arch-register/api-types/colors';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import type {
  SchemaDbResult,
  SharedFieldGroupDbResult,
  WorkspaceEnumDbResult
} from '../../domain/catalog/db/catalogDatabase';
import type { SupportedCurrencyDbResult } from '../../domain/workspace/db/workspaceDatabase';
import { PII_FIELD_GROUP_ID, WORKSPACE2_ID, WORKSPACE_ID, now } from './constants';

export const seedEnums: WorkspaceEnumDbResult[] = [
  {
    id: '00000000-0000-0000-0000-e00000000005',
    workspace: WORKSPACE_ID,
    name: 'PII Classification',
    options: [
      { value: 'none', label: 'None' },
      { value: 'public', label: 'Public' },
      { value: 'non-sensitive', label: 'Non-Sensitive' },
      { value: 'sensitive', label: 'Sensitive' },
      { value: 'highly-sensitive', label: 'Highly Sensitive' }
    ],
    sort_order: 3,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000001',
    workspace: WORKSPACE_ID,
    name: 'API Type',
    options: [
      { value: 'openapi', label: 'OpenAPI' },
      { value: 'grpc', label: 'gRPC' },
      { value: 'graphql', label: 'GraphQL' },
      { value: 'asyncapi', label: 'AsyncAPI' }
    ],
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000003',
    workspace: WORKSPACE_ID,
    name: 'Technology Category',
    options: [
      { value: 'language', label: 'Language' },
      { value: 'framework', label: 'Framework' },
      { value: 'database', label: 'Database' },
      { value: 'operating-system', label: 'Operating System' },
      { value: 'runtime', label: 'Runtime' },
      { value: 'library', label: 'Library' }
    ],
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000004',
    workspace: WORKSPACE_ID,
    name: 'Technology Radar Status',
    options: [
      { value: 'adopt', label: 'Adopt' },
      { value: 'trial', label: 'Trial' },
      { value: 'assess', label: 'Assess' },
      { value: 'hold', label: 'Hold' }
    ],
    sort_order: 2,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000006',
    workspace: WORKSPACE_ID,
    name: 'Data Flow Direction',
    options: [
      { value: 'one-way', label: 'One-way' },
      { value: 'bidirectional', label: 'Bidirectional' }
    ],
    sort_order: 4,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000007',
    workspace: WORKSPACE_ID,
    name: 'Communication Protocol',
    options: [
      { value: 'https-rest', label: 'HTTPS / REST' },
      { value: 'grpc', label: 'gRPC' },
      { value: 'kafka', label: 'Kafka' },
      { value: 'file-transfer', label: 'Batch File Transfer' },
      { value: 'database-replication', label: 'Database Replication' }
    ],
    sort_order: 5,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000008',
    workspace: WORKSPACE_ID,
    name: 'Contract Purpose',
    options: [
      { value: 'license', label: 'License' },
      { value: 'support', label: 'Support' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'hosting', label: 'Hosting' },
      { value: 'professional-services', label: 'Professional Services' },
      { value: 'other', label: 'Other' }
    ],
    sort_order: 6,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000009',
    workspace: WORKSPACE_ID,
    name: 'Risk Status',
    options: [
      { value: 'open', label: 'Open' },
      { value: 'mitigating', label: 'Mitigating' },
      { value: 'accepted', label: 'Accepted' },
      { value: 'closed', label: 'Closed' }
    ],
    sort_order: 7,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e0000000000a',
    workspace: WORKSPACE_ID,
    name: 'Mitigation Effectiveness',
    options: [
      { value: 'none', label: 'None' },
      { value: 'partial', label: 'Partial' },
      { value: 'substantial', label: 'Substantial' },
      { value: 'full', label: 'Full' }
    ],
    sort_order: 8,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e0000000000b',
    workspace: WORKSPACE_ID,
    name: 'Control Type',
    options: [
      { value: 'preventive', label: 'Preventive' },
      { value: 'detective', label: 'Detective' },
      { value: 'corrective', label: 'Corrective' },
      { value: 'compensating', label: 'Compensating' }
    ],
    sort_order: 9,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e0000000000c',
    workspace: WORKSPACE_ID,
    name: 'Control Effectiveness',
    options: [
      { value: 'effective', label: 'Effective' },
      { value: 'partially-effective', label: 'Partially Effective' },
      { value: 'ineffective', label: 'Ineffective' },
      { value: 'not-tested', label: 'Not Tested' }
    ],
    sort_order: 10,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e0000000000d',
    workspace: WORKSPACE_ID,
    name: 'Framework Kind',
    options: [
      { value: 'soc2', label: 'SOC 2' },
      { value: 'iso27001', label: 'ISO 27001' },
      { value: 'nist', label: 'NIST' },
      { value: 'custom', label: 'Custom' }
    ],
    sort_order: 11,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e0000000000e',
    workspace: WORKSPACE_ID,
    name: 'Requirement Status',
    options: [
      { value: 'not-started', label: 'Not Started' },
      { value: 'in-progress', label: 'In Progress' },
      { value: 'met', label: 'Met' },
      { value: 'not-applicable', label: 'Not Applicable' }
    ],
    sort_order: 12,
    created_at: now,
    updated_at: now
  },
  // Second workspace enums
  {
    id: '00000000-0000-0000-0000-e00000000002',
    workspace: WORKSPACE2_ID,
    name: 'Platform',
    options: [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'web', label: 'Web' }
    ],
    sort_order: 0,
    created_at: now,
    updated_at: now
  }
];

export const seedSupportedCurrencies: SupportedCurrencyDbResult[] = [
  { workspace: WORKSPACE_ID, code: 'USD', label: 'US Dollar', sort_order: 0 },
  { workspace: WORKSPACE_ID, code: 'EUR', label: 'Euro', sort_order: 1 },
  { workspace: WORKSPACE_ID, code: 'GBP', label: 'British Pound', sort_order: 2 },
  { workspace: WORKSPACE_ID, code: 'SEK', label: 'Swedish Krona', sort_order: 3 },
  { workspace: WORKSPACE_ID, code: 'NOK', label: 'Norwegian Krone', sort_order: 4 },
  { workspace: WORKSPACE_ID, code: 'DKK', label: 'Danish Krone', sort_order: 5 },
  { workspace: WORKSPACE2_ID, code: 'USD', label: 'US Dollar', sort_order: 0 },
  { workspace: WORKSPACE2_ID, code: 'EUR', label: 'Euro', sort_order: 1 }
];

const PII_FIELDS: SchemaField[] = [
  {
    id: 'pii_classification',
    name: 'PII Classification',
    type: 'select' as const,
    enumId: '00000000-0000-0000-0000-e00000000005',
    groupId: PII_FIELD_GROUP_ID
  },
  { id: 'pii_scope', name: 'PII Scope', type: 'text' as const, groupId: PII_FIELD_GROUP_ID }
];

export const seedSharedFieldGroups: SharedFieldGroupDbResult[] = [
  {
    id: PII_FIELD_GROUP_ID,
    workspace: WORKSPACE_ID,
    name: 'PII Classification',
    description: 'Classifies personal data handled by the entity and documents its scope.',
    fields: PII_FIELDS,
    sort_order: 3,
    created_at: now,
    updated_at: now
  }
];

export const seedSchemas: SchemaDbResult[] = (
  [
    {
      id: '00000000-0000-0000-0000-000000000001',
      workspace: WORKSPACE_ID,
      name: 'Domain',
      description: 'A high-level grouping that owns one or more Systems.',
      fields: [],
      color: AR_COLOR_YELLOW,
      icon: 'globe',
      default_owner: null,
      key_prefix: 'DOM',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      workspace: WORKSPACE_ID,
      name: 'System',
      description:
        'A collection of resources that exposes one or more APIs to users and other Systems.',
      fields: [
        {
          id: 'domain',
          name: 'Domain',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000001',
          minCount: 1,
          maxCount: 1
        },
        // Surfaces the "Data Flow" typed relation (see seedRelationSchemas below) inline as two
        // directional fields, rather than only via the relation's own listing UI — demonstrates
        // #2606's typedRelation SchemaField binding a relation schema + direction to an entity
        // schema field.
        {
          id: 'data_flows_out',
          name: 'Data Flows Out',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000030',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'data_flows_in',
          name: 'Data Flows In',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000030',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'provides_apis',
          name: 'Provided APIs',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000034',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'consumes_apis',
          name: 'Consumed APIs',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000035',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'contracts',
          name: 'Contracts',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000031',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'budget',
          name: 'Budget',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'entity.contracts.map(.allocation * .entity.annual_cost.amount / 100) |> sum',
          resultType: 'number'
        }
      ],
      color: AR_COLOR_PURPLE,
      icon: 'layers',
      default_owner: null,
      key_prefix: 'SYS',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000003',
      workspace: WORKSPACE_ID,
      name: 'Component',
      description: 'A deployable unit of code within a System (service, library, website, etc.).',
      fields: [
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          predicate: 'uses',
          schemaId: '00000000-0000-0000-0000-000000000006',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'system',
          name: 'System',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000002',
          minCount: 1,
          maxCount: 1
        },
        {
          id: 'provides_apis',
          name: 'Provided APIs',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000034',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'consumes_apis',
          name: 'Consumed APIs',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000035',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'depends_on',
          name: 'Depends On',
          type: 'reference',
          predicate: 'depends on',
          schemaId: '00000000-0000-0000-0000-000000000003',
          minCount: 0,
          maxCount: -1
        }
      ],
      color: AR_COLOR_GREEN,
      icon: 'box',
      default_owner: null,
      key_prefix: 'CMP',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000009',
      workspace: WORKSPACE_ID,
      name: 'Contract',
      description: 'A commercial agreement with a vendor supporting a System.',
      fields: [
        {
          id: 'vendor',
          name: 'Vendor',
          type: 'containment',
          predicate: 'provided by',
          schemaId: '00000000-0000-0000-0000-000000000010',
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
          requirementLevel: 'optional',
          expression: 'entity.system.map(.allocation) |> sum',
          resultType: 'number'
        },
        {
          id: 'system',
          name: 'System',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000031',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        }
      ],
      validation_rules: [
        {
          id: 'allocated-at-most-100',
          name: 'Allocated cannot exceed 100%',
          expression: 'entity.allocated <= 100',
          message: 'A Contract cannot be allocated to more than 100% of its capacity.',
          severity: 'error',
          fieldId: 'allocated',
          active: true
        }
      ],
      color: AR_COLOR_ORANGE,
      icon: 'certificate',
      default_owner: null,
      key_prefix: 'CON',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000010',
      workspace: WORKSPACE_ID,
      name: 'Vendor',
      description: 'A company that provides products or services under one or more Contracts.',
      fields: [],
      color: AR_COLOR_BLUE,
      icon: 'building',
      default_owner: null,
      key_prefix: 'VND',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000004',
      workspace: WORKSPACE_ID,
      name: 'API',
      description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
      fields: [
        {
          id: 'api_type',
          name: 'Type',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000001'
        },
        {
          id: 'protocols',
          name: 'Protocols',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000007',
          requirementLevel: 'required',
          minCardinality: 1,
          maxCardinality: -1
        },
        {
          id: 'system',
          name: 'System',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000002',
          minCount: 1,
          maxCount: 1
        },
        { id: 'api_version', name: 'API Version', type: 'text' },
        {
          id: 'providers',
          name: 'Providers',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000034',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'consumers',
          name: 'Consumers',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000035',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        }
      ],
      color: AR_COLOR_BLUE,
      icon: 'api',
      default_owner: null,
      key_prefix: 'API',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000005',
      workspace: WORKSPACE_ID,
      name: 'Resource',
      description:
        'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
      fields: [
        { id: 'resource_type', name: 'Type', type: 'text' },
        {
          id: 'technology_releases',
          name: 'Technology Releases',
          type: 'reference',
          predicate: 'uses',
          schemaId: '00000000-0000-0000-0000-000000000006',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'system',
          name: 'System',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000002',
          minCount: 0,
          maxCount: 1
        }
      ],
      color: AR_COLOR_ORANGE,
      icon: 'database',
      default_owner: null,
      key_prefix: 'RES',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000008',
      workspace: WORKSPACE_ID,
      name: 'Data Entity',
      description:
        'A named category of data (e.g. a business object or record type) that can be carried ' +
        'by a Data Flow relation between Systems (see seedRelationSchemas below, #2670).',
      fields: [
        {
          id: 'classification',
          name: 'Classification',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000005',
          requirementLevel: 'optional'
        }
      ],
      color: AR_COLOR_CYAN,
      icon: 'tag',
      default_owner: null,
      key_prefix: 'DE',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000007',
      workspace: WORKSPACE_ID,
      name: 'Technology',
      description: 'A technology product tracked for governance and planning.',
      fields: [
        { id: 'product', name: 'Product', type: 'text' },
        { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
        {
          id: 'category',
          name: 'Category',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000003'
        },
        {
          id: 'radar_status',
          name: 'Radar Status',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000004'
        }
      ],
      color: AR_COLOR_BLUE,
      icon: 'chip',
      default_owner: null,
      key_prefix: 'TECH',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000006',
      workspace: WORKSPACE_ID,
      name: 'Technology Release',
      description:
        'A product release cycle tracked for support lifecycle, technology radar governance, and planning.',
      fields: [
        {
          id: 'technology',
          name: 'Technology',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000007',
          minCount: 1,
          maxCount: 1
        },
        { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
        { id: 'release_cycle', name: 'Release Cycle', type: 'text' },
        {
          id: 'latest_version',
          name: 'Latest Version',
          type: 'text'
        },
        {
          id: 'release_date',
          name: 'Release Date',
          type: 'date'
        },
        {
          id: 'active_support_until',
          name: 'Active Support Until',
          type: 'date'
        },
        {
          id: 'security_support_until',
          name: 'Security Support Until',
          type: 'date'
        },
        {
          id: 'eol_date',
          name: 'EOL Date',
          type: 'date'
        },
        {
          id: 'source_url',
          name: 'Source URL',
          type: 'text'
        },
        {
          id: 'last_synchronized',
          name: 'Last Synchronized',
          type: 'date'
        },
        {
          id: 'category',
          name: 'Category',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000003'
        },
        {
          id: 'radar_status',
          name: 'Radar Status',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000004'
        }
      ],
      color: AR_COLOR_BLUE,
      icon: 'cpu',
      default_owner: null,
      key_prefix: 'TEC',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000013',
      workspace: WORKSPACE_ID,
      name: 'Risk',
      description: 'A potential adverse event rated by likelihood and impact.',
      fields: [
        { id: 'likelihood', name: 'Likelihood', type: 'number', min: 1, max: 5 },
        { id: 'impact', name: 'Impact', type: 'number', min: 1, max: 5 },
        {
          id: 'inherent_risk_score',
          name: 'Inherent Risk Score',
          type: 'derived',
          requirementLevel: 'optional',
          expression: 'entity.likelihood * entity.impact',
          resultType: 'number'
        },
        {
          id: 'mitigation_effectiveness',
          name: 'Mitigation Effectiveness',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000a'
        },
        {
          id: 'residual_risk_score',
          name: 'Residual Risk Score',
          type: 'derived',
          requirementLevel: 'optional',
          expression:
            "entity.likelihood * (entity.mitigation_effectiveness == 'full' ? 0 : entity.mitigation_effectiveness == 'substantial' ? (entity.impact - 2 < 1 ? 1 : entity.impact - 2) : entity.mitigation_effectiveness == 'partial' ? (entity.impact - 1 < 1 ? 1 : entity.impact - 1) : entity.impact)",
          resultType: 'number'
        },
        { id: 'risk_owner', name: 'Risk Owner', type: 'text' },
        {
          id: 'status',
          name: 'Status',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000009'
        },
        { id: 'treatment_target_date', name: 'Treatment Target Date', type: 'date' },
        {
          id: 'mitigating_controls',
          name: 'Mitigating Controls',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000032',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ],
      color: AR_COLOR_RED,
      icon: 'alert-octagon',
      default_owner: null,
      key_prefix: 'RISK',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000014',
      workspace: WORKSPACE_ID,
      name: 'Control',
      description: 'A safeguard that mitigates one or more Risks.',
      fields: [
        {
          id: 'control_type',
          name: 'Type',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000b'
        },
        {
          id: 'design_effectiveness',
          name: 'Design Effectiveness',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000c'
        },
        {
          id: 'operating_effectiveness',
          name: 'Operating Effectiveness',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000c'
        },
        { id: 'last_verified', name: 'Last Verified', type: 'date' },
        {
          id: 'mitigated_risks',
          name: 'Mitigated Risks',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000032',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        },
        {
          id: 'satisfied_requirements',
          name: 'Satisfied Requirements',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000033',
          direction: 'in',
          minCount: 0,
          maxCount: -1
        }
      ],
      color: AR_COLOR_GREEN,
      icon: 'check-circle',
      default_owner: null,
      key_prefix: 'CTRL',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000015',
      workspace: WORKSPACE_ID,
      name: 'Framework',
      description:
        'A compliance framework (e.g. SOC 2, ISO 27001, NIST) with a requirement catalog.',
      fields: [
        {
          id: 'framework_kind',
          name: 'Kind',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000d'
        },
        { id: 'description', name: 'Description', type: 'text' }
      ],
      color: AR_COLOR_BLUE,
      icon: 'book',
      default_owner: null,
      key_prefix: 'FRWK',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000016',
      workspace: WORKSPACE_ID,
      name: 'Compliance Requirement',
      description: 'A single requirement from a Framework requirement catalog.',
      fields: [
        { id: 'requirement_code', name: 'Requirement Code', type: 'text' },
        { id: 'description', name: 'Description', type: 'text' },
        {
          id: 'status',
          name: 'Status',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e0000000000e'
        },
        {
          id: 'framework',
          name: 'Framework',
          type: 'containment',
          predicate: 'belongs to',
          schemaId: '00000000-0000-0000-0000-000000000015',
          minCount: 1,
          maxCount: 1
        },
        {
          id: 'satisfying_controls',
          name: 'Satisfying Controls',
          type: 'typedRelation',
          requirementLevel: null,
          relationSchemaId: '00000000-0000-0000-0000-000000000033',
          direction: 'out',
          minCount: 0,
          maxCount: -1
        }
      ],
      color: AR_COLOR_PURPLE,
      icon: 'file-check',
      default_owner: null,
      key_prefix: 'CREQ',
      created_at: now,
      updated_at: now
    },
    // Second workspace schemas
    {
      id: '00000000-0000-0000-0000-000000000011',
      workspace: WORKSPACE2_ID,
      name: 'Application',
      description: 'A mobile or web application delivered to end users.',
      fields: [
        {
          id: 'platform',
          name: 'Platform',
          type: 'select',
          enumId: '00000000-0000-0000-0000-e00000000002'
        }
      ],
      color: AR_COLOR_TEAL,
      icon: 'box',
      default_owner: null,
      key_prefix: 'APP',
      created_at: now,
      updated_at: now
    },
    {
      id: '00000000-0000-0000-0000-000000000012',
      workspace: WORKSPACE2_ID,
      name: 'Service',
      description: 'A backend service or microservice.',
      fields: [{ id: 'technology', name: 'Technology', type: 'text' }],
      color: AR_COLOR_CYAN,
      icon: 'layers',
      default_owner: null,
      key_prefix: 'SVC',
      created_at: now,
      updated_at: now
    }
  ] as SchemaDbResult[]
).map((schema): SchemaDbResult => {
  if (schema.workspace !== WORKSPACE_ID || !['API', 'Component', 'System'].includes(schema.name)) {
    return schema;
  }
  return {
    ...schema,
    fields: [...schema.fields, ...PII_FIELDS],
    groups: [
      ...(schema.groups ?? []),
      {
        id: PII_FIELD_GROUP_ID,
        name: 'PII Classification',
        description: 'Classifies personal data handled by the entity and documents its scope.'
      }
    ],
    shared_field_group_links: [{ groupId: PII_FIELD_GROUP_ID }]
  };
});
