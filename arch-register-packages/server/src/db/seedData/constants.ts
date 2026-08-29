import { seededUsers, seededWorkspaces } from '../seedFixtures';

export const now = new Date('2026-01-01T00:00:00.000Z');

export const WORKSPACE_ID = seededWorkspaces.default.id;
export const WORKSPACE2_ID = seededWorkspaces.second.id;

export const API_PROVIDER_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000034';
export const API_CONSUMER_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000035';

export const LIFECYCLE_IDS = {
  proposed: '90000000-0000-0000-0000-000000000011',
  experimental: '90000000-0000-0000-0000-000000000012',
  production: '90000000-0000-0000-0000-000000000013',
  deprecated: '90000000-0000-0000-0000-000000000014'
} as const;

export const LIFECYCLE2_IDS = {
  active: '90000000-0000-0000-0000-000000000015',
  beta: '90000000-0000-0000-0000-000000000016',
  stable: '90000000-0000-0000-0000-000000000017',
  retired: '90000000-0000-0000-0000-000000000018'
} as const;

export const TEAM_IDS = {
  platform: '90000000-0000-0000-0000-000000000021',
  design: '90000000-0000-0000-0000-000000000022',
  security: '90000000-0000-0000-0000-000000000023',
  data: '90000000-0000-0000-0000-000000000024',
  payments: '90000000-0000-0000-0000-000000000027'
} as const;

export const TEAM2_IDS = {
  mobile: '90000000-0000-0000-0000-000000000025',
  backend: '90000000-0000-0000-0000-000000000026'
} as const;

export const GLOSSARY_IDS = {
  statusEnum: '00000000-0000-0000-0000-e0000000000f',
  termCategorySchema: '00000000-0000-0000-0017-000000000001',
  termSchema: '00000000-0000-0000-0018-000000000001',
  categories: {
    customer: '00000000-0000-0000-0017-000000000101',
    data: '00000000-0000-0000-0017-000000000102',
    technology: '00000000-0000-0000-0017-000000000103'
  },
  terms: {
    customerAccount: '00000000-0000-0000-0018-000000000101',
    dataProduct: '00000000-0000-0000-0018-000000000102',
    systemOfRecord: '00000000-0000-0000-0018-000000000103',
    dataDomain: '00000000-0000-0000-0018-000000000104'
  }
} as const;

export const STRATEGY_IDS = {
  statusEnum: '00000000-0000-0000-0000-e00000000010',
  objectiveSchema: '00000000-0000-0000-0019-000000000001',
  outcomeSchema: '00000000-0000-0000-001a-000000000001',
  initiativeSchema: '00000000-0000-0000-001b-000000000001',
  measureSchema: '00000000-0000-0000-001c-000000000001',
  businessCapabilitySchema: '00000000-0000-0000-001f-000000000001',
  businessCapabilities: {
    customerEngagement: '00000000-0000-0000-001f-000000000101',
    selfServiceManagement: '00000000-0000-0000-001f-000000000102',
    accountManagement: '00000000-0000-0000-001f-000000000103',
    platformReliability: '00000000-0000-0000-001f-000000000104',
    observabilityManagement: '00000000-0000-0000-001f-000000000105'
  },
  objectives: {
    improveCustomerRetention: '00000000-0000-0000-0019-000000000101',
    strengthenPlatformReliability: '00000000-0000-0000-0019-000000000102'
  },
  outcomes: {
    reduceChurnRate: '00000000-0000-0000-001a-000000000101',
    increasePlatformUptime: '00000000-0000-0000-001a-000000000102'
  },
  initiatives: {
    portalRedesign: '00000000-0000-0000-001b-000000000101',
    observabilityUplift: '00000000-0000-0000-001b-000000000102'
  },
  measures: {
    monthlyChurnRate: '00000000-0000-0000-001c-000000000101',
    platformUptimePercent: '00000000-0000-0000-001c-000000000102'
  }
} as const;

export const OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID =
  '00000000-0000-0000-0000-000000000037';
export const OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000038';
export const BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID =
  '00000000-0000-0000-0000-000000000039';
export const CONTROL_AFFECTS_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-00000000003a';

// Ids for the "demo" bootstrap dataset's Business Capability tree (an online-retailer capability
// map), used only when `pnpm bootstrap` is run with `--dataset demo` (the default). Deliberately a
// separate id range (...0002XX) from STRATEGY_IDS.businessCapabilities (...0001XX) so the two
// datasets' capability content never overlaps.
export const DEMO_BUSINESS_CAPABILITY_IDS = {
  // L1
  merchandisingAssortment: '00000000-0000-0000-001f-000000000201',
  marketingCustomerAcquisition: '00000000-0000-0000-001f-000000000202',
  salesCommerceExperience: '00000000-0000-0000-001f-000000000203',
  orderFulfillmentLogistics: '00000000-0000-0000-001f-000000000204',
  customerServiceSupport: '00000000-0000-0000-001f-000000000205',
  supplyChainVendorManagement: '00000000-0000-0000-001f-000000000206',
  financePayments: '00000000-0000-0000-001f-000000000207',
  platformReliabilityOperations: '00000000-0000-0000-001f-000000000208',
  // L2
  productCatalogManagement: '00000000-0000-0000-001f-000000000209',
  pricingPromotions: '00000000-0000-0000-001f-00000000020a',
  digitalMarketing: '00000000-0000-0000-001f-00000000020b',
  customerEngagement: '00000000-0000-0000-001f-00000000020c',
  storefrontExperience: '00000000-0000-0000-001f-00000000020d',
  cartCheckout: '00000000-0000-0000-001f-00000000020e',
  orderManagement: '00000000-0000-0000-001f-00000000020f',
  warehouseDelivery: '00000000-0000-0000-001f-000000000210',
  customerCareOperations: '00000000-0000-0000-001f-000000000211',
  selfServiceManagement: '00000000-0000-0000-001f-000000000212',
  supplierManagement: '00000000-0000-0000-001f-000000000213',
  procurementDemandPlanning: '00000000-0000-0000-001f-000000000214',
  paymentsManagement: '00000000-0000-0000-001f-000000000215',
  financialOperations: '00000000-0000-0000-001f-000000000216',
  platformReliability: '00000000-0000-0000-001f-000000000217',
  dataAnalyticsPlatform: '00000000-0000-0000-001f-000000000218',
  // L3
  productInformationManagement: '00000000-0000-0000-001f-000000000219',
  digitalAssetManagement: '00000000-0000-0000-001f-00000000021a',
  promotionDiscountManagement: '00000000-0000-0000-001f-00000000021b',
  campaignManagement: '00000000-0000-0000-001f-00000000021c',
  seoContentMarketing: '00000000-0000-0000-001f-00000000021d',
  loyaltyRewardsManagement: '00000000-0000-0000-001f-00000000021e',
  personalizationRecommendations: '00000000-0000-0000-001f-00000000021f',
  siteMerchandising: '00000000-0000-0000-001f-000000000220',
  searchNavigation: '00000000-0000-0000-001f-000000000221',
  checkoutOrchestration: '00000000-0000-0000-001f-000000000222',
  orderOrchestration: '00000000-0000-0000-001f-000000000223',
  returnsRefundsManagement: '00000000-0000-0000-001f-000000000224',
  inventoryWarehouseManagement: '00000000-0000-0000-001f-000000000225',
  shippingLastMileDelivery: '00000000-0000-0000-001f-000000000226',
  contactCenterManagement: '00000000-0000-0000-001f-000000000227',
  accountManagement: '00000000-0000-0000-001f-000000000228',
  orderTrackingSelfService: '00000000-0000-0000-001f-000000000229',
  supplierOnboarding: '00000000-0000-0000-001f-00000000022a',
  supplierPerformanceManagement: '00000000-0000-0000-001f-00000000022b',
  purchaseOrderManagement: '00000000-0000-0000-001f-00000000022c',
  paymentProcessing: '00000000-0000-0000-001f-00000000022d',
  fraudRiskManagement: '00000000-0000-0000-001f-00000000022e',
  billingInvoicing: '00000000-0000-0000-001f-00000000022f',
  observabilityManagement: '00000000-0000-0000-001f-000000000230',
  incidentProblemManagement: '00000000-0000-0000-001f-000000000231',
  dataPlatformManagement: '00000000-0000-0000-001f-000000000232'
} as const;

// Ids for the "demo" bootstrap dataset's Objective/Outcome/Initiative/Measure chains, each
// supporting one of the DEMO_BUSINESS_CAPABILITY_IDS capabilities. Replaces (rather than extends)
// the 2 test-dataset chains in STRATEGY_IDS when `--dataset demo` is used, same convention as
// DEMO_BUSINESS_CAPABILITY_IDS.
export const DEMO_STRATEGY_GOAL_IDS = {
  objectives: {
    expandProductAssortment: '00000000-0000-0000-0019-000000000201',
    growNewCustomerAcquisition: '00000000-0000-0000-0019-000000000202',
    increaseCheckoutConversion: '00000000-0000-0000-0019-000000000203',
    reduceDeliveryTime: '00000000-0000-0000-0019-000000000204',
    improveSupplierOnTimeDelivery: '00000000-0000-0000-0019-000000000205',
    reducePaymentFraudLosses: '00000000-0000-0000-0019-000000000206'
  },
  outcomes: {
    increaseCatalogBreadth: '00000000-0000-0000-001a-000000000201',
    increaseNewCustomerSignups: '00000000-0000-0000-001a-000000000202',
    reduceCartAbandonmentRate: '00000000-0000-0000-001a-000000000203',
    shortenAverageDeliveryWindow: '00000000-0000-0000-001a-000000000204',
    increaseSupplierOnTimeRate: '00000000-0000-0000-001a-000000000205',
    lowerFraudLossRate: '00000000-0000-0000-001a-000000000206'
  },
  initiatives: {
    marketplaceSellerOnboarding: '00000000-0000-0000-001b-000000000201',
    performanceMarketingExpansion: '00000000-0000-0000-001b-000000000202',
    checkoutFlowSimplification: '00000000-0000-0000-001b-000000000203',
    regionalFulfillmentCenterExpansion: '00000000-0000-0000-001b-000000000204',
    supplierScorecardProgram: '00000000-0000-0000-001b-000000000205',
    realTimeFraudDetectionRollout: '00000000-0000-0000-001b-000000000206'
  },
  measures: {
    activeSkuCount: '00000000-0000-0000-001c-000000000201',
    monthlyNewCustomerSignups: '00000000-0000-0000-001c-000000000202',
    cartAbandonmentRate: '00000000-0000-0000-001c-000000000203',
    averageDeliveryDays: '00000000-0000-0000-001c-000000000204',
    supplierOnTimeDeliveryRate: '00000000-0000-0000-001c-000000000205',
    fraudLossRate: '00000000-0000-0000-001c-000000000206'
  }
} as const;

export const COLLECTION_IDS = {
  criticalSystems: '00000000-0000-0000-0030-000000000001',
  apisToReview: '00000000-0000-0000-0030-000000000002'
} as const;

export const TECHNOLOGY_IDS = {
  nodejs: '00000000-0000-0000-0007-000000000001',
  react: '00000000-0000-0000-0007-000000000002',
  go: '00000000-0000-0000-0007-000000000003',
  python: '00000000-0000-0000-0007-000000000004',
  java: '00000000-0000-0000-0007-000000000005',
  rust: '00000000-0000-0000-0007-000000000006',
  postgresql: '00000000-0000-0000-0007-000000000007',
  redis: '00000000-0000-0000-0007-000000000008',
  kafka: '00000000-0000-0000-0007-000000000009',
  elasticsearch: '00000000-0000-0000-0007-00000000000a'
} as const;

export const TECHNOLOGY_RELEASE_IDS = {
  nodejs20: '00000000-0000-0000-0006-000000000001',
  react18: '00000000-0000-0000-0006-000000000002',
  go122: '00000000-0000-0000-0006-000000000003',
  python312: '00000000-0000-0000-0006-000000000004',
  java21: '00000000-0000-0000-0006-000000000005',
  rust182: '00000000-0000-0000-0006-000000000006',
  postgres15: '00000000-0000-0000-0006-000000000007',
  redis7: '00000000-0000-0000-0006-000000000008',
  kafka37: '00000000-0000-0000-0006-000000000009',
  elasticsearch8: '00000000-0000-0000-0006-00000000000a'
} as const;

// Fresh id ranges for the demo dataset's technology stack (Technology, Technology Release,
// Resource) - distinct from the test dataset's `...01XX` ranges above and from every other demo
// id range used elsewhere in this file.
export const DEMO_TECHNOLOGY_IDS = {
  technologies: {
    nodejs: '00000000-0000-0000-0007-000000000301',
    typescript: '00000000-0000-0000-0007-000000000302',
    react: '00000000-0000-0000-0007-000000000303',
    go: '00000000-0000-0000-0007-000000000304',
    python: '00000000-0000-0000-0007-000000000305',
    java: '00000000-0000-0000-0007-000000000306',
    postgresql: '00000000-0000-0000-0007-000000000307',
    redis: '00000000-0000-0000-0007-000000000308',
    kafka: '00000000-0000-0000-0007-000000000309',
    elasticsearch: '00000000-0000-0000-0007-00000000030a',
    rust: '00000000-0000-0000-0007-00000000030b',
    kubernetes: '00000000-0000-0000-0007-00000000030c',
    docker: '00000000-0000-0000-0007-00000000030d',
    snowflake: '00000000-0000-0000-0007-00000000030e'
  },
  releases: {
    nodejs22: '00000000-0000-0000-0006-000000000301',
    typescript54: '00000000-0000-0000-0006-000000000302',
    react19: '00000000-0000-0000-0006-000000000303',
    go123: '00000000-0000-0000-0006-000000000304',
    python313: '00000000-0000-0000-0006-000000000305',
    java21: '00000000-0000-0000-0006-000000000306',
    postgres16: '00000000-0000-0000-0006-000000000307',
    redis75: '00000000-0000-0000-0006-000000000308',
    kafka38: '00000000-0000-0000-0006-000000000309',
    elasticsearch815: '00000000-0000-0000-0006-00000000030a',
    rust182: '00000000-0000-0000-0006-00000000030b',
    kubernetes130: '00000000-0000-0000-0006-00000000030c',
    docker27: '00000000-0000-0000-0006-00000000030d',
    snowflake: '00000000-0000-0000-0006-00000000030e',
    // Extra historical releases (Node.js, PostgreSQL, Kubernetes) showcasing the one-to-many
    // relationship between a Technology and its Technology Releases.
    nodejs18: '00000000-0000-0000-0006-00000000030f',
    nodejs20: '00000000-0000-0000-0006-000000000310',
    postgres14: '00000000-0000-0000-0006-000000000311',
    postgres15: '00000000-0000-0000-0006-000000000312',
    kubernetes128: '00000000-0000-0000-0006-000000000313',
    kubernetes129: '00000000-0000-0000-0006-000000000314'
  },
  resources: {
    postgresMain: '00000000-0000-0000-0005-000000000301',
    redisCache: '00000000-0000-0000-0005-000000000302',
    kafkaEventBus: '00000000-0000-0000-0005-000000000303',
    s3DataLake: '00000000-0000-0000-0005-000000000304',
    paymentsPostgres: '00000000-0000-0000-0005-000000000305',
    elasticsearchCluster: '00000000-0000-0000-0005-000000000306',
    analyticsWarehouse: '00000000-0000-0000-0005-000000000307',
    cdn: '00000000-0000-0000-0005-000000000308',
    identitySessionCache: '00000000-0000-0000-0005-000000000309',
    paymentsKubernetesCluster: '00000000-0000-0000-0005-00000000030a',
    notificationPostgres: '00000000-0000-0000-0005-00000000030b',
    searchQueryCache: '00000000-0000-0000-0005-00000000030c'
  }
} as const;

// Additive ids for the demo dataset's extra Domain/System/Component/API/Data Entity rows. Unlike
// every other DEMO_*_IDS block, these are NOT a replacement for the test dataset's architecture
// entities - Domain/System/Component/API/Data Entity are referenced by literal id from many other
// demo files (resources, governance relations, project links), so the base rows stay and these are
// added alongside them, continuing the public_id numbering (DOM-4+, SYS-7+, CMP-17+, API-7+, DE-4+).
export const DEMO_ARCHITECTURE_IDS = {
  domains: {
    catalogMerchandising: '00000000-0000-0000-0001-000000000301',
    orderFulfillmentSupplyChain: '00000000-0000-0000-0001-000000000302',
    marketingGrowth: '00000000-0000-0000-0001-000000000303'
  },
  systems: {
    productCatalogService: '00000000-0000-0000-0002-000000000301',
    orderManagementSystem: '00000000-0000-0000-0002-000000000302',
    fulfillmentLogisticsPlatform: '00000000-0000-0000-0002-000000000303',
    marketingAutomationPlatform: '00000000-0000-0000-0002-000000000304'
  },
  components: {
    catalogService: '00000000-0000-0000-0003-000000000301',
    pricingEngine: '00000000-0000-0000-0003-000000000302',
    catalogSyncWorker: '00000000-0000-0000-0003-000000000303',
    orderOrchestrator: '00000000-0000-0000-0003-000000000304',
    inventoryService: '00000000-0000-0000-0003-000000000305',
    shippingIntegrationService: '00000000-0000-0000-0003-000000000306',
    warehouseManagementService: '00000000-0000-0000-0003-000000000307',
    campaignService: '00000000-0000-0000-0003-000000000308',
    promotionsEngine: '00000000-0000-0000-0003-000000000309',
    personalizationService: '00000000-0000-0000-0003-00000000030a'
  },
  apis: {
    catalogApi: '00000000-0000-0000-0004-000000000301',
    orderApi: '00000000-0000-0000-0004-000000000302',
    inventoryApi: '00000000-0000-0000-0004-000000000303',
    shippingApi: '00000000-0000-0000-0004-000000000304',
    marketingApi: '00000000-0000-0000-0004-000000000305'
  },
  dataEntities: {
    productCatalogData: '00000000-0000-0000-0008-000000000301',
    orderRecords: '00000000-0000-0000-0008-000000000302',
    inventoryLevels: '00000000-0000-0000-0008-000000000303',
    marketingConsentRecords: '00000000-0000-0000-0008-000000000304'
  }
} as const;

// Additive ids for the demo dataset's extra Vendor/Contract rows - same rationale as
// DEMO_ARCHITECTURE_IDS: Vendor/Contract are referenced by literal id from relations.ts
// (system-contract) and demoGovernanceRelations.ts (risk-affects), so the base VND-1/2 and
// CON-1/2/3 rows stay and these are added alongside them, continuing the public_id numbering.
export const DEMO_VENDOR_IDS = {
  vendors: {
    meridianPayments: '00000000-0000-0000-000b-000000000301',
    northwindLogistics: '00000000-0000-0000-000b-000000000302',
    brightWaveMarketing: '00000000-0000-0000-000b-000000000303',
    snowcapData: '00000000-0000-0000-000b-000000000304'
  },
  contracts: {
    meridianGatewayLicense: '00000000-0000-0000-000a-000000000301',
    meridianGatewaySupport: '00000000-0000-0000-000a-000000000302',
    northwindCarrierLicense: '00000000-0000-0000-000a-000000000303',
    brightWavePlatformLicense: '00000000-0000-0000-000a-000000000304',
    snowcapWarehouseLicense: '00000000-0000-0000-000a-000000000305'
  }
} as const;

export const USER_IDS = {
  globaladmin: seededUsers.globalAdmin.id,
  workspaceadmin: seededUsers.workspaceAdmin.id,
  workspaceowner: seededUsers.workspaceOwner.id,
  platformteamadmin: seededUsers.platformTeamAdmin.id,
  platformteameditor: seededUsers.platformTeamEditor.id,
  designteamadmin: seededUsers.designTeamAdmin.id,
  securityteamadmin: seededUsers.securityTeamAdmin.id,
  workspaceeditor: seededUsers.workspaceEditor.id,
  workspacereviewer: seededUsers.workspaceReviewer.id,
  workspaceviewer: seededUsers.workspaceViewer.id
} as const;

export const seedIds = {
  workspace: {
    default: WORKSPACE_ID,
    second: WORKSPACE2_ID
  },
  lifecycle: LIFECYCLE_IDS,
  lifecycle2: LIFECYCLE2_IDS,
  teams: TEAM_IDS,
  teams2: TEAM2_IDS,
  glossary: GLOSSARY_IDS,
  strategy: STRATEGY_IDS,
  collections: COLLECTION_IDS,
  technologies: TECHNOLOGY_IDS,
  technologyReleases: TECHNOLOGY_RELEASE_IDS,
  users: USER_IDS
} as const;

export const RETENTION_IDS = {
  timeUnitEnum: '00000000-0000-0000-0042-000000000003',
  policySchema: '00000000-0000-0000-0042-000000000001',
  assignmentRelationSchema: '00000000-0000-0000-0042-000000000002',
  capabilityConfiguration: '00000000-0000-0000-0042-000000000004',
  policies: {
    threeYearOperational: '00000000-0000-0000-0042-000000000101',
    sevenYearFinancial: '00000000-0000-0000-0042-000000000102'
  },
  assignments: {
    customerPortal: '00000000-0000-0000-0042-000000000201',
    identityPlatform: '00000000-0000-0000-0042-000000000202',
    customerCredentials: '00000000-0000-0000-0042-000000000203'
  }
} as const;

// Ids for the "demo" bootstrap dataset's governance content (Risk, Control, Framework, Compliance
// Requirement), each chain wired via the risk-control / control-requirement relation schemas and
// the Compliance Requirement's `framework` containment field. Fresh id ranges (...0002XX) distinct
// from the test dataset's content ids, same convention as DEMO_BUSINESS_CAPABILITY_IDS.
export const DEMO_RISK_COMPLIANCE_IDS = {
  frameworks: {
    soc2TypeIi: '00000000-0000-0000-0017-000000000201',
    iso27001: '00000000-0000-0000-0017-000000000202',
    pciDss: '00000000-0000-0000-0017-000000000203',
    gdpr: '00000000-0000-0000-0017-000000000204'
  },
  complianceRequirements: {
    soc2LogicalAccess: '00000000-0000-0000-000f-000000000201',
    soc2SystemMonitoring: '00000000-0000-0000-000f-000000000202',
    iso27001Cryptography: '00000000-0000-0000-000f-000000000203',
    iso27001SupplierSecurity: '00000000-0000-0000-000f-000000000204',
    pciProtectCardholderData: '00000000-0000-0000-000f-000000000205',
    pciTrackMonitorAccess: '00000000-0000-0000-000f-000000000206',
    gdprSecurityOfProcessing: '00000000-0000-0000-000f-000000000207',
    gdprRightToErasure: '00000000-0000-0000-000f-000000000208'
  },
  controls: {
    mfaEnforcement: '00000000-0000-0000-000d-000000000201',
    siemAlerting: '00000000-0000-0000-000d-000000000202',
    encryptionAtRest: '00000000-0000-0000-000d-000000000203',
    vendorSecurityReview: '00000000-0000-0000-000d-000000000204',
    cardholderDataTokenization: '00000000-0000-0000-000d-000000000205',
    paymentAccessLogging: '00000000-0000-0000-000d-000000000206',
    piiAccessControls: '00000000-0000-0000-000d-000000000207',
    dataDeletionAutomation: '00000000-0000-0000-000d-000000000208'
  },
  risks: {
    customerAccountTakeover: '00000000-0000-0000-000c-000000000201',
    undetectedDataExfiltration: '00000000-0000-0000-000c-000000000202',
    plaintextCustomerPiiAtRest: '00000000-0000-0000-000c-000000000203',
    thirdPartyVendorDataBreach: '00000000-0000-0000-000c-000000000204',
    paymentCardDataBreach: '00000000-0000-0000-000c-000000000205',
    unauthorizedAccessToPaymentLogs: '00000000-0000-0000-000c-000000000206',
    unauthorizedInternalPiiAccess: '00000000-0000-0000-000c-000000000207',
    nonCompliantErasureRequests: '00000000-0000-0000-000c-000000000208'
  }
} as const;

// Ids for the "demo" bootstrap dataset's Retention Policies and their retention-assignment
// relations, fresh ranges distinct from RETENTION_IDS' test-dataset content ids.
export const DEMO_RETENTION_IDS = {
  policies: {
    paymentTransactionRecords: '00000000-0000-0000-0042-000000000501',
    customerPiiRecords: '00000000-0000-0000-0042-000000000502',
    marketingConsentRecords: '00000000-0000-0000-0042-000000000503',
    orderFulfillmentRecords: '00000000-0000-0000-0042-000000000504'
  },
  assignments: {
    transactionEvents: '00000000-0000-0000-0042-000000000601',
    customerCredentials: '00000000-0000-0000-0042-000000000602',
    clickstreamEvents: '00000000-0000-0000-0042-000000000603',
    paymentsPlatform: '00000000-0000-0000-0042-000000000604'
  }
} as const;

// Ids for the "demo" bootstrap dataset's business glossary (Term Category, Term), fresh ranges
// distinct from the test dataset's GLOSSARY_IDS content ids (...0017-0000000001XX /
// ...0018-0000000001XX) and the demo governance frameworks (...0017-0000000002XX).
export const DEMO_GLOSSARY_IDS = {
  categories: {
    catalogMerchandising: '00000000-0000-0000-0017-000000000301',
    customerIdentity: '00000000-0000-0000-0017-000000000302',
    ordersFulfillment: '00000000-0000-0000-0017-000000000303',
    paymentsFinance: '00000000-0000-0000-0017-000000000304',
    marketingGrowth: '00000000-0000-0000-0017-000000000305',
    dataAnalytics: '00000000-0000-0000-0017-000000000306',
    technologyArchitecture: '00000000-0000-0000-0017-000000000307',
    riskCompliance: '00000000-0000-0000-0017-000000000308'
  },
  terms: {
    sku: '00000000-0000-0000-0018-000000000201',
    productVariant: '00000000-0000-0000-0018-000000000202',
    assortment: '00000000-0000-0000-0018-000000000203',
    merchandisingRule: '00000000-0000-0000-0018-000000000204',
    customerAccount: '00000000-0000-0000-0018-000000000205',
    guestCheckout: '00000000-0000-0000-0018-000000000206',
    customerLifetimeValue: '00000000-0000-0000-0018-000000000207',
    churn: '00000000-0000-0000-0018-000000000208',
    segment: '00000000-0000-0000-0018-000000000209',
    orderOrchestration: '00000000-0000-0000-0018-00000000020a',
    fulfillmentCenter: '00000000-0000-0000-0018-00000000020b',
    backorder: '00000000-0000-0000-0018-00000000020c',
    lastMileDelivery: '00000000-0000-0000-0018-00000000020d',
    returnMerchandiseAuthorization: '00000000-0000-0000-0018-00000000020e',
    cardholderData: '00000000-0000-0000-0018-00000000020f',
    chargeback: '00000000-0000-0000-0018-000000000210',
    settlement: '00000000-0000-0000-0018-000000000211',
    paymentGateway: '00000000-0000-0000-0018-000000000212',
    reconciliation: '00000000-0000-0000-0018-000000000213',
    conversionRate: '00000000-0000-0000-0018-000000000214',
    customerAcquisitionCost: '00000000-0000-0000-0018-000000000215',
    cartAbandonment: '00000000-0000-0000-0018-000000000216',
    attributionModel: '00000000-0000-0000-0018-000000000217',
    dataProduct: '00000000-0000-0000-0018-000000000218',
    dataDomain: '00000000-0000-0000-0018-000000000219',
    clickstream: '00000000-0000-0000-0018-00000000021a',
    dataLineage: '00000000-0000-0000-0018-00000000021b',
    systemOfRecord: '00000000-0000-0000-0018-00000000021c',
    apiGateway: '00000000-0000-0000-0018-00000000021d',
    idempotencyKey: '00000000-0000-0000-0018-00000000021e',
    eventDrivenArchitecture: '00000000-0000-0000-0018-00000000021f',
    personallyIdentifiableInformation: '00000000-0000-0000-0018-000000000220',
    dataSubject: '00000000-0000-0000-0018-000000000221',
    residualRisk: '00000000-0000-0000-0018-000000000222',
    controlEffectiveness: '00000000-0000-0000-0018-000000000223'
  }
} as const;

export const INFO_ASSET_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000002';

export const INFO_ASSET_IDS = {
  regulatoryTagsEnum: '00000000-0000-0000-0043-000000000001',
  processingPurposesEnum: '00000000-0000-0000-0043-000000000002',
  residencyRegionsEnum: '00000000-0000-0000-0043-000000000003'
} as const;

export const PROJECT_ENTITY_TYPE_IDS = {
  introduced: '90000000-0000-0000-0000-000000000201',
  decommissioned: '90000000-0000-0000-0000-000000000202',
  modified: '90000000-0000-0000-0000-000000000203',
  used: '90000000-0000-0000-0000-000000000204'
} as const;

export const MILESTONE_IDS = {
  portalRedesign: {
    designFinalized: '00000000-0000-0000-0040-000000000001',
    frontendRollout: '00000000-0000-0000-0040-000000000002',
    legacyPortalDecommission: '00000000-0000-0000-0040-000000000003'
  },
  authMigration: {
    identityCutover: '00000000-0000-0000-0040-000000000004',
    legacyAuthDecommission: '00000000-0000-0000-0040-000000000005'
  },
  checkoutRevamp: {
    paymentGatewayIntegration: '00000000-0000-0000-0040-000000000006',
    fraudDetectionRollout: '00000000-0000-0000-0040-000000000007'
  },
  searchAnalytics: {
    searchPlatformGa: '00000000-0000-0000-0040-000000000008',
    analyticsWarehouseMigration: '00000000-0000-0000-0040-000000000009'
  }
} as const;

export const PII_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000001';

export const AUTH_API_ENTITY_ID = '00000000-0000-0000-0004-000000000002';

export const CONTENT_IDS = {
  authApiOverviewFolder: '00000000-0000-0000-0030-000000000001',
  authApiOverviewDiagram: '00000000-0000-0000-0030-000000000002',
  authApiSequenceDiagram: '00000000-0000-0000-0030-000000000003',
  authApiSecurityFolder: '00000000-0000-0000-0030-000000000004',
  authApiThreatModel: '00000000-0000-0000-0030-000000000005',
  wsArchitectureOverview: '00000000-0000-0000-0031-000000000001',
  wsStandardsFolder: '00000000-0000-0000-0031-000000000002',
  wsApiDesignGuide: '00000000-0000-0000-0031-000000000003',
  wsDeploymentTopology: '00000000-0000-0000-0031-000000000004',
  wsWikiFolder: '00000000-0000-0000-0031-000000000005',
  wsWikiHome: '00000000-0000-0000-0031-000000000006',
  wsWikiMarkdownCheatsheet: '00000000-0000-0000-0031-000000000007',
  wsWikiEntityWidgets: '00000000-0000-0000-0031-000000000008',
  wsWikiDiagramsAndViews: '00000000-0000-0000-0031-000000000009',
  wsAdrFolder: '00000000-0000-0000-0031-000000000010',
  wsAdrApiVersioning: '00000000-0000-0000-0031-000000000011',
  wsAdrAsyncMessaging: '00000000-0000-0000-0031-000000000012',
  wsAdrAuthentication: '00000000-0000-0000-0031-000000000013',
  wsAdrObservability: '00000000-0000-0000-0031-000000000014',
  wsAdrDataOwnership: '00000000-0000-0000-0031-000000000015',
  checkoutRevampPlanningFolder: '00000000-0000-0000-0032-000000000001',
  checkoutRevampProjectBrief: '00000000-0000-0000-0032-000000000002',
  checkoutRevampRolloutPlan: '00000000-0000-0000-0032-000000000003'
} as const;

export const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
export const DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000003';
export const RISK_AFFECTS_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000036';
// Domain, System, Component, API, Resource, Technology Release, Technology, Data Entity, Contract, Vendor.
export const RISK_AFFECTS_TARGET_SCHEMA_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000010'
];
export const RISK_CONTROL_SCHEMA_ID = '00000000-0000-0000-0000-000000000032';
export const CONTROL_REQUIREMENT_SCHEMA_ID = '00000000-0000-0000-0000-000000000033';

// Stable identifiers used by the deterministic template materialization that backs the bundled
// demo catalog. Keeping these separate from the template's symbolic ids lets normal workspace
// creation continue to allocate fresh ids while preserving the existing seed fixture contract.
export const SEED_SCHEMA_IDS = {
  domain: '00000000-0000-0000-0000-000000000001',
  system: '00000000-0000-0000-0000-000000000002',
  component: '00000000-0000-0000-0000-000000000003',
  api: '00000000-0000-0000-0000-000000000004',
  resource: '00000000-0000-0000-0000-000000000005',
  technologyRelease: '00000000-0000-0000-0000-000000000006',
  technology: '00000000-0000-0000-0000-000000000007',
  dataEntity: '00000000-0000-0000-0000-000000000008',
  contract: '00000000-0000-0000-0000-000000000009',
  vendor: '00000000-0000-0000-0000-000000000010',
  risk: '00000000-0000-0000-0000-000000000013',
  control: '00000000-0000-0000-0000-000000000014',
  framework: '00000000-0000-0000-0000-000000000015',
  complianceRequirement: '00000000-0000-0000-0000-000000000016',
  termCategory: GLOSSARY_IDS.termCategorySchema,
  term: GLOSSARY_IDS.termSchema,
  businessCapability: STRATEGY_IDS.businessCapabilitySchema,
  objective: STRATEGY_IDS.objectiveSchema,
  outcome: STRATEGY_IDS.outcomeSchema,
  initiative: STRATEGY_IDS.initiativeSchema,
  measure: STRATEGY_IDS.measureSchema,
  retentionPolicy: RETENTION_IDS.policySchema,
  application: '00000000-0000-0000-0000-000000000011',
  service: '00000000-0000-0000-0000-000000000012'
} as const;

export const SEED_CATEGORY_IDS = {
  architecture: '00000000-0000-0000-0000-c00000000001'
} as const;

export const SEED_ENUM_IDS = {
  apiType: '00000000-0000-0000-0000-e00000000001',
  platform: '00000000-0000-0000-0000-e00000000002',
  technologyCategory: '00000000-0000-0000-0000-e00000000003',
  technologyRadarStatus: '00000000-0000-0000-0000-e00000000004',
  piiClassification: '00000000-0000-0000-0000-e00000000005',
  dataFlowDirection: '00000000-0000-0000-0000-e00000000006',
  communicationProtocol: '00000000-0000-0000-0000-e00000000007',
  contractPurpose: '00000000-0000-0000-0000-e00000000008',
  riskStatus: '00000000-0000-0000-0000-e00000000009',
  mitigationEffectiveness: '00000000-0000-0000-0000-e0000000000a',
  controlType: '00000000-0000-0000-0000-e0000000000b',
  controlEffectiveness: '00000000-0000-0000-0000-e0000000000c',
  frameworkKind: '00000000-0000-0000-0000-e0000000000d',
  requirementStatus: '00000000-0000-0000-0000-e0000000000e',
  glossaryStatus: GLOSSARY_IDS.statusEnum,
  strategyStatus: STRATEGY_IDS.statusEnum,
  regulatoryTags: INFO_ASSET_IDS.regulatoryTagsEnum,
  processingPurposes: INFO_ASSET_IDS.processingPurposesEnum,
  residencyRegions: INFO_ASSET_IDS.residencyRegionsEnum,
  retentionTimeUnit: RETENTION_IDS.timeUnitEnum
} as const;

export const SEED_RELATION_SCHEMA_IDS = {
  dataFlow: DATA_FLOW_SCHEMA_ID,
  systemContract: '00000000-0000-0000-0000-000000000031',
  riskMitigation: RISK_CONTROL_SCHEMA_ID,
  controlCompliance: CONTROL_REQUIREMENT_SCHEMA_ID,
  providesApi: API_PROVIDER_RELATION_SCHEMA_ID,
  consumesApi: API_CONSUMER_RELATION_SCHEMA_ID,
  riskAffects: RISK_AFFECTS_RELATION_SCHEMA_ID,
  controlAffects: CONTROL_AFFECTS_RELATION_SCHEMA_ID,
  objectiveSupportsCapability: OBJECTIVE_SUPPORTS_BUSINESS_CAPABILITY_RELATION_SCHEMA_ID,
  objectiveAffectsEntity: OBJECTIVE_AFFECTS_ENTITY_RELATION_SCHEMA_ID,
  capabilitySupportsEntity: BUSINESS_CAPABILITY_SUPPORTS_ENTITY_RELATION_SCHEMA_ID,
  retentionAssignment: RETENTION_IDS.assignmentRelationSchema
} as const;

export const SEED_FIELD_GROUP_IDS = {
  piiClassification: PII_FIELD_GROUP_ID,
  informationAssetStewardship: INFO_ASSET_FIELD_GROUP_ID,
  dataFlowGovernance: DATA_FLOW_GOVERNANCE_FIELD_GROUP_ID
} as const;

export const SEED_SCHEMA_KEY_PREFIXES = {
  domain: 'DOM',
  system: 'SYS',
  component: 'CMP',
  api: 'API',
  resource: 'RES',
  contract: 'CON',
  vendor: 'VND',
  technology: 'TECH',
  technologyRelease: 'TEC',
  dataEntity: 'DE',
  risk: 'RISK',
  control: 'CTRL',
  framework: 'FRWK',
  complianceRequirement: 'CREQ',
  termCategory: 'TCAT',
  term: 'TERM',
  businessCapability: 'CAP',
  objective: 'OBJ',
  outcome: 'OUTC',
  initiative: 'INIT',
  measure: 'MEAS',
  retentionPolicy: 'RETN',
  application: 'APP',
  service: 'SVC'
} as const;
