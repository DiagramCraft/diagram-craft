import {
  AR_COLOR_BLUE,
  AR_COLOR_GREEN,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_RED,
  AR_COLOR_TEAL
} from '@arch-register/api-types/colors';
import type {
  RelationDbCreate,
  RelationSchemaDbResult
} from '../../domain/catalog/db/relationDatabase';
import { seedEntities, seedEntitiesRaw } from './entities';
import {
  API_CONSUMER_RELATION_SCHEMA_ID,
  API_PROVIDER_RELATION_SCHEMA_ID,
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  CONTROL_REQUIREMENT_SCHEMA_ID,
  DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID,
  DATA_FLOW_SCHEMA_ID,
  INFO_ASSET_IDS,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
  RETENTION_IDS,
  RISK_AFFECTS_RELATION_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
  STRATEGY_IDS,
  WORKSPACE_ID,
  now
} from './constants';

// Typed relation objects (see #2569/#2570): a "Data Flow" relation type between Systems,
// modeling upstream/downstream data movement as a first-class relation instead of a generic
// reference field (see #2532).
export const seedRelationSchemas: RelationSchemaDbResult[] = [
  {
    id: '00000000-0000-0000-0000-000000000034',
    workspace: WORKSPACE_ID,
    name: 'Provides API',
    category: 'Architecture',
    description: 'Associates a Component or System with an API it provides.',
    in_label: 'Provides APIs',
    out_label: 'Provided by Component or System',
    in_schema_ids: ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000004'],
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_GREEN,
    icon: 'plug',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000035',
    workspace: WORKSPACE_ID,
    name: 'Consumes API',
    category: 'Architecture',
    description: 'Associates a Component or System with an API it consumes.',
    in_label: 'Consumes APIs',
    out_label: 'Consumed by Component or System',
    in_schema_ids: ['00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000004'],
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_BLUE,
    icon: 'download',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000031',
    workspace: WORKSPACE_ID,
    name: 'System Contract',
    category: 'Architecture',
    description:
      'Associates a System with a vendor Contract and records the purpose of the agreement.',
    in_label: 'Uses Contract',
    out_label: 'Used by System',
    in_schema_ids: ['00000000-0000-0000-0000-000000000002'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000009'],
    fields: [
      {
        id: 'purpose',
        name: 'Purpose',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000008',
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
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_ORANGE,
    icon: 'certificate',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000030',
    workspace: WORKSPACE_ID,
    name: 'Data Flow',
    category: 'Data',
    description:
      'Models data moving from one System to another: its direction, the sensitivity of the ' +
      'data carried, and the protocol used to move it.',
    in_label: 'Sends data to System',
    out_label: 'Receives data from System',
    in_schema_ids: ['00000000-0000-0000-0000-000000000002'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000002'],
    fields: [
      {
        id: 'direction',
        name: 'Direction',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000006',
        requirementLevel: 'required'
      },
      {
        id: 'data_classification',
        name: 'Data Classification',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000005',
        requirementLevel: 'required'
      },
      {
        id: 'protocol',
        name: 'Protocol',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000007',
        requirementLevel: 'optional'
      },
      // Entity-valued relation field (#2670): the Data Entity/Entities carried by this Data
      // Flow, distinct from the relation's fixed in/out System endpoints.
      {
        id: 'data_entities',
        name: 'Data',
        type: 'entityRelation',
        requirementLevel: 'optional',
        predicate: 'carries',
        schemaId: '00000000-0000-0000-0000-000000000008',
        minCount: 0,
        maxCount: -1
      },
      // Transfer-specific governance metadata (#3065): shares the regulatory-tags,
      // processing-purposes, and residency-regions vocabularies configured for information
      // assets (#3062/#3064), but records them at the flow level.
      {
        id: 'regulatory_tags',
        name: 'Regulatory Tags',
        type: 'select',
        enumId: INFO_ASSET_IDS.regulatoryTagsEnum,
        minCardinality: 0,
        maxCardinality: -1,
        groupId: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
      },
      {
        id: 'processing_purposes',
        name: 'Processing Purposes',
        type: 'select',
        enumId: INFO_ASSET_IDS.processingPurposesEnum,
        minCardinality: 0,
        maxCardinality: -1,
        groupId: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
      },
      {
        id: 'source_residency_region',
        name: 'Source Residency Region',
        type: 'select',
        enumId: INFO_ASSET_IDS.residencyRegionsEnum,
        requirementLevel: 'optional',
        groupId: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
      },
      {
        id: 'destination_residency_region',
        name: 'Destination Residency Region',
        type: 'select',
        enumId: INFO_ASSET_IDS.residencyRegionsEnum,
        requirementLevel: 'optional',
        groupId: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
      }
    ],
    groups: [
      {
        id: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID,
        name: 'Data Flow Governance',
        description:
          'Regulatory tags, processing purposes, and source/destination residency regions for ' +
          'this data flow.'
      }
    ],
    shared_field_group_links: [],
    color: AR_COLOR_TEAL,
    icon: 'network',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    workspace: WORKSPACE_ID,
    name: 'Risk Affects',
    category: 'Governance',
    description: 'Associates a Risk with an architecture entity affected by it.',
    in_label: 'Affects Entities',
    out_label: 'Affected by Risk',
    in_schema_ids: ['00000000-0000-0000-0000-000000000013'],
    out_schema_ids: 'any',
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_RED,
    icon: 'alert-triangle',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000032',
    workspace: WORKSPACE_ID,
    name: 'Risk Mitigation',
    category: 'Governance',
    description:
      'Associates a Risk with the Controls that mitigate it and records the control coverage.',
    in_label: 'Mitigated by Control',
    out_label: 'Mitigates Risk',
    in_schema_ids: ['00000000-0000-0000-0000-000000000013'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000014'],
    fields: [
      {
        id: 'effectiveness',
        name: 'Effectiveness',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e0000000000a',
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
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_RED,
    icon: 'shield-check',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000033',
    workspace: WORKSPACE_ID,
    name: 'Control Compliance',
    category: 'Governance',
    description:
      'Records that a Control satisfies a ComplianceRequirement and captures the verification evidence.',
    in_label: 'Satisfies Compliance Requirements',
    out_label: 'Satisfied by Control',
    in_schema_ids: ['00000000-0000-0000-0000-000000000014'],
    out_schema_ids: ['00000000-0000-0000-0000-000000000016'],
    fields: [
      {
        id: 'status',
        name: 'Status',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e0000000000e',
        requirementLevel: 'required'
      },
      { id: 'evidence', name: 'Evidence', type: 'text' },
      { id: 'verified_on', name: 'Verified On', type: 'date' }
    ],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_GREEN,
    icon: 'check-circle',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    workspace: WORKSPACE_ID,
    name: 'Business Capability Supports Entity',
    category: 'Strategy',
    description: 'Associates a Business Capability with an entity that helps realise it.',
    in_label: 'Supports Entities',
    out_label: 'Supported by Business Capabilities',
    in_schema_ids: [STRATEGY_IDS.businessCapabilitySchema],
    out_schema_ids: 'any',
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_PURPLE,
    icon: 'layers',
    created_at: now,
    updated_at: now
  },
  {
    id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    workspace: WORKSPACE_ID,
    name: 'Objective Supports Business Capability',
    category: 'Strategy',
    description: 'Associates an Objective with a Business Capability that supports or enables it.',
    in_label: 'Supports Business Capabilities',
    out_label: 'Supported by Objectives',
    in_schema_ids: [STRATEGY_IDS.objectiveSchema],
    out_schema_ids: [STRATEGY_IDS.businessCapabilitySchema],
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_PURPLE,
    icon: 'target',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
    workspace: WORKSPACE_ID,
    name: 'Objective Affects Entity',
    category: 'Strategy',
    description: 'Associates an Objective with an architecture entity it affects.',
    in_label: 'Affects Entities',
    out_label: 'Affected by Objective',
    in_schema_ids: [STRATEGY_IDS.objectiveSchema],
    out_schema_ids: 'any',
    fields: [],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_BLUE,
    icon: 'target',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: RETENTION_IDS.assignmentRelationSchema,
    workspace: WORKSPACE_ID,
    name: 'Subject to Retention Policy',
    category: 'Governance',
    description:
      'Assigns a retention policy to a governed entity, recording the date it became subject to it.',
    in_label: 'Subject to Retention Policy',
    out_label: 'Governs',
    in_schema_ids: 'any',
    out_schema_ids: [RETENTION_IDS.policySchema],
    fields: [
      {
        id: 'activated_from',
        name: 'Activated From',
        type: 'date',
        requirementLevel: 'required'
      }
    ],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_RED,
    icon: 'clock',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  }
];

const seedEntityById = new Map(seedEntities.map(entity => [entity.id, entity]));
let nextSeedApiRelationIndex = 100;

const seedApiRelations: RelationDbCreate[] = seedEntitiesRaw.flatMap(entity => {
  if (
    entity.schema_id !== '00000000-0000-0000-0000-000000000003' &&
    entity.schema_id !== '00000000-0000-0000-0000-000000000002'
  ) {
    return [];
  }

  const source = seedEntityById.get(entity.id);
  if (!source) return [];

  return (['provides_apis', 'consumes_apis'] as const).flatMap(field => {
    const relationSchemaId =
      field === 'provides_apis' ? API_PROVIDER_RELATION_SCHEMA_ID : API_CONSUMER_RELATION_SCHEMA_ID;
    const references = entity.data[field];
    if (!Array.isArray(references)) return [];

    return references.flatMap(reference => {
      if (typeof reference !== 'string') return [];
      const target = seedEntityById.get(reference);
      if (target?.schema_id !== '00000000-0000-0000-0000-000000000004') return [];

      const relationIndex = nextSeedApiRelationIndex++;
      return [
        {
          id: `00000000-0000-0000-0009-${relationIndex.toString(16).padStart(12, '0')}`,
          workspace: WORKSPACE_ID,
          schema_id: relationSchemaId,
          in_entity_id: source.id,
          out_entity_id: target.id,
          data: {},
          owner: source.owner,
          lifecycle: source.lifecycle,
          created_at: now,
          updated_at: now
        }
      ];
    });
  });
});

export const seedRelations: RelationDbCreate[] = [
  ...seedApiRelations,
  {
    id: '00000000-0000-0000-0009-000000000004',
    workspace: WORKSPACE_ID,
    schema_id: '00000000-0000-0000-0000-000000000031',
    // Customer Portal -> Acme Cloud contract: annual software license.
    in_entity_id: '00000000-0000-0000-0002-000000000001',
    out_entity_id: '00000000-0000-0000-000a-000000000001',
    data: { purpose: 'license', allocation: 60 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0009-000000000005',
    workspace: WORKSPACE_ID,
    schema_id: '00000000-0000-0000-0000-000000000031',
    // Identity Platform -> Nordic Systems contract: managed support.
    in_entity_id: '00000000-0000-0000-0002-000000000002',
    out_entity_id: '00000000-0000-0000-000a-000000000002',
    data: { purpose: 'support', allocation: 100 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0009-000000000006',
    workspace: WORKSPACE_ID,
    schema_id: '00000000-0000-0000-0000-000000000031',
    // Customer Portal -> Acme Cloud support contract.
    in_entity_id: '00000000-0000-0000-0002-000000000001',
    out_entity_id: '00000000-0000-0000-000a-000000000003',
    data: { purpose: 'support', allocation: 40 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0009-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Customer Portal -> Identity Platform: login credentials for authentication.
    in_entity_id: '00000000-0000-0000-0002-000000000001',
    out_entity_id: '00000000-0000-0000-0002-000000000002',
    data: {
      direction: 'one-way',
      data_classification: 'sensitive',
      protocol: 'https-rest',
      data_entities: ['00000000-0000-0000-0008-000000000001']
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0009-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Payments Platform -> Analytics Platform: transaction events for reporting.
    in_entity_id: '00000000-0000-0000-0002-000000000003',
    out_entity_id: '00000000-0000-0000-0002-000000000004',
    data: {
      direction: 'one-way',
      data_classification: 'non-sensitive',
      protocol: 'kafka',
      data_entities: ['00000000-0000-0000-0008-000000000002']
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0009-000000000003',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Customer Portal -> Analytics Platform: user behaviour/clickstream events.
    in_entity_id: '00000000-0000-0000-0002-000000000001',
    out_entity_id: '00000000-0000-0000-0002-000000000004',
    data: {
      direction: 'one-way',
      data_classification: 'sensitive',
      protocol: 'kafka',
      data_entities: ['00000000-0000-0000-0008-000000000003']
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Unauthorized Production Access -> Identity Platform.
    in_entity_id: '00000000-0000-0000-000c-000000000001',
    out_entity_id: '00000000-0000-0000-0002-000000000002',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Unauthorized Production Access -> Auth Service.
    in_entity_id: '00000000-0000-0000-000c-000000000001',
    out_entity_id: '00000000-0000-0000-0003-000000000003',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000003',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Undetected Data Exfiltration -> Analytics Platform.
    in_entity_id: '00000000-0000-0000-000c-000000000002',
    out_entity_id: '00000000-0000-0000-0002-000000000004',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000004',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Undetected Data Exfiltration -> Clickstream Events.
    in_entity_id: '00000000-0000-0000-000c-000000000002',
    out_entity_id: '00000000-0000-0000-0008-000000000003',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000005',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Plaintext Data at Rest -> Customer Portal.
    in_entity_id: '00000000-0000-0000-000c-000000000003',
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000006',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Plaintext Data at Rest -> Postgres Main.
    in_entity_id: '00000000-0000-0000-000c-000000000003',
    out_entity_id: '00000000-0000-0000-0005-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000007',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Plaintext Data at Rest -> Customer Credentials.
    in_entity_id: '00000000-0000-0000-000c-000000000003',
    out_entity_id: '00000000-0000-0000-0008-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    // Unauthorized Production Access <- MFA Enforcement.
    in_entity_id: '00000000-0000-0000-000c-000000000001',
    out_entity_id: '00000000-0000-0000-000d-000000000001',
    data: {
      effectiveness: 'substantial',
      coverage: 90,
      reviewed_on: '2026-01-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    // Undetected Data Exfiltration <- SIEM Alerting.
    in_entity_id: '00000000-0000-0000-000c-000000000002',
    out_entity_id: '00000000-0000-0000-000d-000000000002',
    data: {
      effectiveness: 'partial',
      coverage: 70,
      reviewed_on: '2025-11-15'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000003',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    // Plaintext Data at Rest <- Encryption at Rest.
    in_entity_id: '00000000-0000-0000-000c-000000000003',
    out_entity_id: '00000000-0000-0000-000d-000000000003',
    data: {
      effectiveness: 'substantial',
      coverage: 95,
      reviewed_on: '2025-09-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000004',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    // MFA Enforcement -> CC6.1 Logical Access Controls.
    in_entity_id: '00000000-0000-0000-000d-000000000001',
    out_entity_id: '00000000-0000-0000-000f-000000000001',
    data: {
      status: 'met',
      evidence: 'MFA policy and production access logs',
      verified_on: '2026-01-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000005',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    // SIEM Alerting -> CC7.2 System Monitoring.
    in_entity_id: '00000000-0000-0000-000d-000000000002',
    out_entity_id: '00000000-0000-0000-000f-000000000002',
    data: {
      status: 'in-progress',
      evidence: 'SIEM alerting coverage is being extended to all production workloads',
      verified_on: '2025-11-15'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000006',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    // Encryption at Rest -> A.8.24 Use of Cryptography.
    in_entity_id: '00000000-0000-0000-000d-000000000003',
    out_entity_id: '00000000-0000-0000-000f-000000000003',
    data: {
      status: 'met',
      evidence: 'Encryption standards and storage configuration review',
      verified_on: '2025-09-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Improve Customer Retention -> Self-Service Management.
    in_entity_id: STRATEGY_IDS.objectives.improveCustomerRetention,
    out_entity_id: STRATEGY_IDS.businessCapabilities.selfServiceManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Strengthen Platform Reliability -> Observability Management.
    in_entity_id: STRATEGY_IDS.objectives.strengthenPlatformReliability,
    out_entity_id: STRATEGY_IDS.businessCapabilities.observabilityManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Self-Service Management -> Customer Portal.
    in_entity_id: STRATEGY_IDS.businessCapabilities.selfServiceManagement,
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Observability Management -> Search Platform.
    in_entity_id: STRATEGY_IDS.businessCapabilities.observabilityManagement,
    out_entity_id: '00000000-0000-0000-0002-000000000006',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001e-000000000001',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
    // Improve Customer Retention -> Customer API.
    in_entity_id: STRATEGY_IDS.objectives.improveCustomerRetention,
    out_entity_id: '00000000-0000-0000-0004-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001e-000000000002',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
    // Strengthen Platform Reliability -> Redis Cache.
    in_entity_id: STRATEGY_IDS.objectives.strengthenPlatformReliability,
    out_entity_id: '00000000-0000-0000-0005-000000000002',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: RETENTION_IDS.assignments.customerPortal,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Customer Portal -> three-year operational retention policy, expiring soon (demonstrates
    // the "approaching" status).
    in_entity_id: '00000000-0000-0000-0002-000000000001',
    out_entity_id: RETENTION_IDS.policies.threeYearOperational,
    data: { activated_from: '2023-09-15' },
    created_at: now,
    updated_at: now
  },
  {
    id: RETENTION_IDS.assignments.identityPlatform,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Identity Platform -> seven-year financial/compliance retention policy, already past its
    // expiry date (demonstrates the "expired" status). Other systems are left unassigned to
    // demonstrate the "incomplete" status.
    in_entity_id: '00000000-0000-0000-0002-000000000002',
    out_entity_id: RETENTION_IDS.policies.sevenYearFinancial,
    data: { activated_from: '2018-01-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: RETENTION_IDS.assignments.customerCredentials,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Customer Credentials (Data Entity DE-1) -> three-year operational retention policy —
    // demonstrates retention assigned directly to a Data Entity, not just a System.
    in_entity_id: '00000000-0000-0000-0008-000000000001',
    out_entity_id: RETENTION_IDS.policies.threeYearOperational,
    data: { activated_from: '2024-01-15' },
    created_at: now,
    updated_at: now
  }
];
