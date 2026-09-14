import type { SeedEntityInput } from './entities';
import {
  DEMO_ARCHITECTURE_IDS,
  DEMO_VENDOR_IDS,
  LIFECYCLE_IDS,
  SEED_SCHEMA_IDS,
  TEAM_IDS,
  WORKSPACE_ID,
  now
} from './constants';

// Additive Vendor/Contract rows for the demo dataset - added alongside the test dataset's VND-1/2
// and CON-1/2/3 rows (see the comment on DEMO_VENDOR_IDS in constants.ts for why), continuing the
// public_id numbering from VND-3 and CON-4. Each vendor backs one of the demo architecture systems
// (demoArchitectureEntities.ts / demoTechnologyEntities.ts) via a system-contract relation, defined
// in demoVendorRelations.ts.
const V = DEMO_VENDOR_IDS.vendors;
const K = DEMO_VENDOR_IDS.contracts;

export const demoVendorEntities: SeedEntityInput[] = [
  {
    id: V.meridianPayments,
    workspace: WORKSPACE_ID,
    public_id: 'VND-3',
    slug: 'meridian-payments',
    namespace: 'default',
    name: 'Meridian Payments',
    description: 'Payment gateway provider handling card authorization, capture and settlement.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'payments'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.vendor,
    data: {
      category: 'software',
      tier: 'strategic',
      status: 'active',
      relationship_owner: 'Head of Payments Engineering',
      cost_centre: 'engineering',
      security_risk: 3,
      concentration_risk: 4,
      financial_risk: 2,
      compliance_risk: 3,
      criticality: 5
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: V.northwindLogistics,
    workspace: WORKSPACE_ID,
    public_id: 'VND-4',
    slug: 'northwind-logistics',
    namespace: 'default',
    name: 'Northwind Logistics',
    description: 'Carrier aggregator providing shipping label generation and tracking APIs.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'logistics'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.vendor,
    data: {
      category: 'software',
      tier: 'tactical',
      status: 'active',
      relationship_owner: 'Head of Platform Engineering',
      cost_centre: 'it-operations',
      security_risk: 2,
      concentration_risk: 3,
      financial_risk: 2,
      compliance_risk: 2,
      criticality: 3
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: V.brightWaveMarketing,
    workspace: WORKSPACE_ID,
    public_id: 'VND-5',
    slug: 'brightwave-marketing',
    namespace: 'default',
    name: 'BrightWave Marketing',
    description: 'Email and SMS marketing automation platform used for campaign delivery.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'marketing'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.vendor,
    data: {
      category: 'software',
      tier: 'commodity',
      status: 'active',
      relationship_owner: 'Head of Marketing',
      cost_centre: 'sales-marketing',
      security_risk: 2,
      concentration_risk: 1,
      financial_risk: 1,
      compliance_risk: 2,
      criticality: 2
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: V.snowcapData,
    workspace: WORKSPACE_ID,
    public_id: 'VND-6',
    slug: 'snowcap-data',
    namespace: 'default',
    name: 'Snowcap Data',
    description: 'Managed cloud data warehouse provider backing the analytics platform.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'data'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.vendor,
    data: {
      category: 'cloud-hosting',
      tier: 'strategic',
      status: 'active',
      relationship_owner: 'Head of Data Platform',
      cost_centre: 'engineering',
      security_risk: 3,
      concentration_risk: 4,
      financial_risk: 3,
      compliance_risk: 3,
      criticality: 4
    },
    project_id: null,
    created_at: now,
    updated_at: now
  }
];

export const demoContractEntities: SeedEntityInput[] = [
  {
    id: K.meridianGatewayLicense,
    workspace: WORKSPACE_ID,
    public_id: 'CON-4',
    slug: 'meridian-payments-gateway-license',
    namespace: 'default',
    name: 'Meridian Payments Gateway License',
    description: 'Annual license for the Meridian payment gateway.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'license'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.contract,
    data: {
      vendor: [V.meridianPayments],
      contract_start: '2025-01-01',
      contract_end: '2026-12-31',
      annual_cost: { amount: 96000, currency: 'USD' },
      setup_fee: { amount: 8000, currency: 'USD' },
      contract_type: 'licence',
      auto_renew: true,
      notice_period_days: 90,
      contract_owner: 'Head of Payments Engineering'
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: K.meridianGatewaySupport,
    workspace: WORKSPACE_ID,
    public_id: 'CON-5',
    slug: 'meridian-payments-gateway-support',
    namespace: 'default',
    name: 'Meridian Payments Gateway Support',
    description: 'Priority support and incident response agreement for the payment gateway.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'support'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.contract,
    data: {
      vendor: [V.meridianPayments],
      contract_start: '2025-01-01',
      contract_end: '2026-12-31',
      annual_cost: { amount: 24000, currency: 'USD' },
      setup_fee: { amount: 0, currency: 'USD' },
      contract_type: 'support',
      auto_renew: true,
      notice_period_days: 30,
      contract_owner: 'Head of Payments Engineering'
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: K.northwindCarrierLicense,
    workspace: WORKSPACE_ID,
    public_id: 'CON-6',
    slug: 'northwind-logistics-carrier-license',
    namespace: 'default',
    name: 'Northwind Logistics Carrier License',
    description: 'Annual license for carrier rate-shopping and label generation.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'license'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.contract,
    data: {
      vendor: [V.northwindLogistics],
      contract_start: '2025-04-01',
      contract_end: '2027-03-31',
      annual_cost: { amount: 42000, currency: 'USD' },
      setup_fee: { amount: 5000, currency: 'USD' },
      contract_type: 'licence',
      auto_renew: false,
      notice_period_days: 60,
      contract_owner: 'Head of Platform Engineering'
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: K.brightWavePlatformLicense,
    workspace: WORKSPACE_ID,
    public_id: 'CON-7',
    slug: 'brightwave-marketing-platform-license',
    namespace: 'default',
    name: 'BrightWave Marketing Platform License',
    description: 'Annual subscription for the marketing automation platform.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'license'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.contract,
    data: {
      vendor: [V.brightWaveMarketing],
      contract_start: '2025-06-01',
      contract_end: '2026-05-31',
      annual_cost: { amount: 30000, currency: 'GBP' },
      setup_fee: { amount: 2500, currency: 'GBP' },
      contract_type: 'subscription',
      auto_renew: true,
      notice_period_days: 30,
      contract_owner: 'Head of Marketing'
    },
    project_id: null,
    created_at: now,
    updated_at: now
  },
  {
    id: K.snowcapWarehouseLicense,
    workspace: WORKSPACE_ID,
    public_id: 'CON-8',
    slug: 'snowcap-data-warehouse-license',
    namespace: 'default',
    name: 'Snowcap Data Warehouse License',
    description: 'Consumption-based license for the managed data warehouse.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['vendor', 'license'],
    links: [],
    schema_id: SEED_SCHEMA_IDS.contract,
    data: {
      vendor: [V.snowcapData],
      contract_start: '2025-09-01',
      contract_end: '2026-08-31',
      annual_cost: { amount: 68000, currency: 'USD' },
      setup_fee: { amount: 0, currency: 'USD' },
      contract_type: 'subscription',
      auto_renew: false,
      notice_period_days: 45,
      contract_owner: 'Head of Data Platform'
    },
    project_id: null,
    created_at: now,
    updated_at: now
  }
];

// System ids reused from the shared (non-demo) seed data and from the demo architecture entities.
export const DEMO_VENDOR_CONTRACT_SYSTEMS = {
  paymentsPlatform: '00000000-0000-0000-0002-000000000003',
  analyticsPlatform: '00000000-0000-0000-0002-000000000004',
  fulfillmentLogisticsPlatform: DEMO_ARCHITECTURE_IDS.systems.fulfillmentLogisticsPlatform,
  marketingAutomationPlatform: DEMO_ARCHITECTURE_IDS.systems.marketingAutomationPlatform
};
