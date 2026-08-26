import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import { seedEntities, seedEntitiesRaw } from './entities';
import {
  API_CONSUMER_RELATION_SCHEMA_ID,
  API_PROVIDER_RELATION_SCHEMA_ID,
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  CONTROL_REQUIREMENT_SCHEMA_ID,
  DATA_FLOW_SCHEMA_ID,
  OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  RETENTION_IDS,
  RISK_AFFECTS_RELATION_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
  STRATEGY_IDS,
  WORKSPACE_ID,
  now
} from './constants';
import { seedTemplateRelationSchemaDefinitions as seedRelationSchemas } from './templateDefinitions';

export { seedRelationSchemas };

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
