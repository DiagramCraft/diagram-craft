import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import {
  API_CONSUMER_RELATION_SCHEMA_ID,
  API_PROVIDER_RELATION_SCHEMA_ID,
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  DATA_FLOW_SCHEMA_ID,
  DEMO_ARCHITECTURE_IDS,
  DEMO_BUSINESS_CAPABILITY_IDS,
  DEMO_RETENTION_IDS,
  LIFECYCLE_IDS,
  RETENTION_IDS,
  TEAM_IDS,
  WORKSPACE_ID,
  now
} from './constants';

// Relations wiring the demo architecture content (demoArchitectureEntities.ts) together:
// Component/System -provides-api/consumes-api-> API (relations.ts auto-generates these for the
// test dataset from entity data fields, but that generator only runs over seedEntitiesRaw, so
// these additive demo entities need their own explicit rows), System -data-flow-> System carrying
// Data Entities, Data Entity -retention-assignment-> Retention Policy, and Business Capability
// -business-capability-supports-entity-> System/Component (ties this round back into the strategy
// tree built earlier).
const S = DEMO_ARCHITECTURE_IDS.systems;
const C = DEMO_ARCHITECTURE_IDS.components;
const A = DEMO_ARCHITECTURE_IDS.apis;
const DE = DEMO_ARCHITECTURE_IDS.dataEntities;

const apiRelation = (
  id: string,
  schemaId: string,
  sourceId: string,
  apiId: string,
  owner: string
): RelationDbCreate => ({
  id,
  workspace: WORKSPACE_ID,
  schema_id: schemaId,
  in_entity_id: sourceId,
  out_entity_id: apiId,
  data: {},
  owner,
  lifecycle: LIFECYCLE_IDS.production,
  created_at: now,
  updated_at: now
});

export const demoArchitectureRelations: RelationDbCreate[] = [
  // Provides API
  apiRelation(
    '00000000-0000-0000-0021-000000000201',
    API_PROVIDER_RELATION_SCHEMA_ID,
    C.catalogService,
    A.catalogApi,
    TEAM_IDS.design
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000202',
    API_PROVIDER_RELATION_SCHEMA_ID,
    C.orderOrchestrator,
    A.orderApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000203',
    API_PROVIDER_RELATION_SCHEMA_ID,
    C.inventoryService,
    A.inventoryApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000204',
    API_PROVIDER_RELATION_SCHEMA_ID,
    C.shippingIntegrationService,
    A.shippingApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000205',
    API_PROVIDER_RELATION_SCHEMA_ID,
    C.campaignService,
    A.marketingApi,
    TEAM_IDS.design
  ),

  // Consumes API
  apiRelation(
    '00000000-0000-0000-0021-000000000206',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.pricingEngine,
    A.catalogApi,
    TEAM_IDS.design
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000207',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.pricingEngine,
    A.marketingApi,
    TEAM_IDS.design
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000208',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.orderOrchestrator,
    A.catalogApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-000000000209',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.shippingIntegrationService,
    A.orderApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-00000000020a',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.shippingIntegrationService,
    A.inventoryApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-00000000020b',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.warehouseManagementService,
    A.inventoryApi,
    TEAM_IDS.platform
  ),
  apiRelation(
    '00000000-0000-0000-0021-00000000020c',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.promotionsEngine,
    A.catalogApi,
    TEAM_IDS.design
  ),
  apiRelation(
    '00000000-0000-0000-0021-00000000020d',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.promotionsEngine,
    A.marketingApi,
    TEAM_IDS.design
  ),
  apiRelation(
    '00000000-0000-0000-0021-00000000020e',
    API_CONSUMER_RELATION_SCHEMA_ID,
    C.personalizationService,
    A.marketingApi,
    TEAM_IDS.data
  ),

  // Data flows
  {
    id: '00000000-0000-0000-0021-000000000301',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Product Catalog Service -> Order Management System: product data for order line items.
    in_entity_id: S.productCatalogService,
    out_entity_id: S.orderManagementSystem,
    data: {
      direction: 'one-way',
      data_classification: 'non-sensitive',
      protocol: 'https-rest',
      data_entities: [DE.productCatalogData]
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000302',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Order Management System -> Fulfillment & Logistics Platform: orders ready to ship.
    in_entity_id: S.orderManagementSystem,
    out_entity_id: S.fulfillmentLogisticsPlatform,
    data: {
      direction: 'one-way',
      data_classification: 'sensitive',
      protocol: 'https-rest',
      data_entities: [DE.orderRecords]
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000303',
    workspace: WORKSPACE_ID,
    schema_id: DATA_FLOW_SCHEMA_ID,
    // Marketing Automation Platform -> Analytics Platform: consent state for campaign reporting.
    in_entity_id: S.marketingAutomationPlatform,
    out_entity_id: '00000000-0000-0000-0002-000000000004',
    data: {
      direction: 'one-way',
      data_classification: 'sensitive',
      protocol: 'kafka',
      data_entities: [DE.marketingConsentRecords]
    },
    created_at: now,
    updated_at: now
  },

  // Retention assignments
  {
    id: '00000000-0000-0000-0021-000000000401',
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Order Records -> Order & Fulfillment Records.
    in_entity_id: DE.orderRecords,
    out_entity_id: DEMO_RETENTION_IDS.policies.orderFulfillmentRecords,
    data: { activated_from: '2024-01-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000402',
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Marketing Consent Records -> Marketing Consent Records (policy).
    in_entity_id: DE.marketingConsentRecords,
    out_entity_id: DEMO_RETENTION_IDS.policies.marketingConsentRecords,
    data: { activated_from: '2025-03-01' },
    created_at: now,
    updated_at: now
  },

  // Business capability -> architecture entity
  {
    id: '00000000-0000-0000-0021-000000000501',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Product Information Management -> Product Catalog Service.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.productInformationManagement,
    out_entity_id: S.productCatalogService,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000502',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Order Orchestration -> Order Management System.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.orderOrchestration,
    out_entity_id: S.orderManagementSystem,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000503',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Inventory & Warehouse Management -> Inventory Service.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.inventoryWarehouseManagement,
    out_entity_id: C.inventoryService,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000504',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Shipping & Last-Mile Delivery -> Shipping Integration Service.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.shippingLastMileDelivery,
    out_entity_id: C.shippingIntegrationService,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000505',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Campaign Management -> Marketing Automation Platform.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.campaignManagement,
    out_entity_id: S.marketingAutomationPlatform,
    data: {},
    created_at: now,
    updated_at: now
  }
];
