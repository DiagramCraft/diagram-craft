import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import {
  BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  DEMO_BUSINESS_CAPABILITY_IDS,
  DEMO_STRATEGY_GOAL_IDS,
  OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  WORKSPACE_ID,
  now
} from './constants';

// Sample relations wiring the demo strategy entities (demoStrategyEntities.ts) into the rest of
// the demo dataset, mirroring the relations seeded for the "test" tree in relations.ts. Each demo
// Objective supports the demo Business Capability most relevant to its work.
export const demoStrategyRelations: RelationDbCreate[] = [
  {
    id: '00000000-0000-0000-001d-000000000201',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Expand Product Assortment -> Product Catalog Management.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.expandProductAssortment,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.productCatalogManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000202',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Grow New Customer Acquisition -> Campaign Management.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.growNewCustomerAcquisition,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.campaignManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000203',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Increase Checkout Conversion -> Checkout Orchestration.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.increaseCheckoutConversion,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.checkoutOrchestration,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000204',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Reduce Delivery Time -> Shipping & Last-Mile Delivery.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.reduceDeliveryTime,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.shippingLastMileDelivery,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000205',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Improve Supplier On-Time Delivery -> Supplier Performance Management.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.improveSupplierOnTimeDelivery,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.supplierPerformanceManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-001d-000000000206',
    workspace: WORKSPACE_ID,
    schema_id: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
    // Reduce Payment Fraud Losses -> Fraud & Risk Management.
    in_entity_id: DEMO_STRATEGY_GOAL_IDS.objectives.reducePaymentFraudLosses,
    out_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.fraudRiskManagement,
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000201',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Account Management -> Customer Portal.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.accountManagement,
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000202',
    workspace: WORKSPACE_ID,
    schema_id: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
    // Search & Navigation -> Search Platform.
    in_entity_id: DEMO_BUSINESS_CAPABILITY_IDS.searchNavigation,
    out_entity_id: '00000000-0000-0000-0002-000000000006',
    data: {},
    created_at: now,
    updated_at: now
  }
];
