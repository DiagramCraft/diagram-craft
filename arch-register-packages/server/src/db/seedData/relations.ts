import {
  AR_COLOR_BLUE,
  AR_COLOR_GREEN,
  AR_COLOR_ORANGE,
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
  CONTROL_REQUIREMENT_SCHEMA_ID,
  DATA_FLOW_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
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
    description: 'Associates a Component or System with an API it provides.',
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
    description: 'Associates a Component or System with an API it consumes.',
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
    description:
      'Associates a System with a vendor Contract and records the purpose of the agreement.',
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
    description:
      'Models data moving from one System to another: its direction, the sensitivity of the ' +
      'data carried, and the protocol used to move it.',
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
      }
    ],
    groups: [],
    shared_field_group_links: [],
    color: AR_COLOR_TEAL,
    icon: 'network',
    relation_approval_policy: 'disabled',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000032',
    workspace: WORKSPACE_ID,
    name: 'Risk Mitigation',
    description:
      'Associates a Risk with the Controls that mitigate it and records the control coverage.',
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
    description:
      'Records that a Control satisfies a ComplianceRequirement and captures the verification evidence.',
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
  }
];
