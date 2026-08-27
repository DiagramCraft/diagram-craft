import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import { DEMO_VENDOR_IDS, SEED_RELATION_SCHEMA_IDS, WORKSPACE_ID, now } from './constants';
import { DEMO_VENDOR_CONTRACT_SYSTEMS as SYS } from './demoVendorEntities';

// system-contract relations wiring the demo vendor content (demoVendorEntities.ts) to the systems
// that use each contract - one per contract, each fully allocated since no contract here is shared
// across multiple systems.
const K = DEMO_VENDOR_IDS.contracts;

export const demoVendorRelations: RelationDbCreate[] = [
  {
    id: '00000000-0000-0000-0021-000000000601',
    workspace: WORKSPACE_ID,
    schema_id: SEED_RELATION_SCHEMA_IDS.systemContract,
    // Payments Platform -> Meridian Payments Gateway License.
    in_entity_id: SYS.paymentsPlatform,
    out_entity_id: K.meridianGatewayLicense,
    data: { purpose: 'license', allocation: 100 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000602',
    workspace: WORKSPACE_ID,
    schema_id: SEED_RELATION_SCHEMA_IDS.systemContract,
    // Payments Platform -> Meridian Payments Gateway Support.
    in_entity_id: SYS.paymentsPlatform,
    out_entity_id: K.meridianGatewaySupport,
    data: { purpose: 'support', allocation: 100 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000603',
    workspace: WORKSPACE_ID,
    schema_id: SEED_RELATION_SCHEMA_IDS.systemContract,
    // Fulfillment & Logistics Platform -> Northwind Logistics Carrier License.
    in_entity_id: SYS.fulfillmentLogisticsPlatform,
    out_entity_id: K.northwindCarrierLicense,
    data: { purpose: 'license', allocation: 100 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000604',
    workspace: WORKSPACE_ID,
    schema_id: SEED_RELATION_SCHEMA_IDS.systemContract,
    // Marketing Automation Platform -> BrightWave Marketing Platform License.
    in_entity_id: SYS.marketingAutomationPlatform,
    out_entity_id: K.brightWavePlatformLicense,
    data: { purpose: 'license', allocation: 100 },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0021-000000000605',
    workspace: WORKSPACE_ID,
    schema_id: SEED_RELATION_SCHEMA_IDS.systemContract,
    // Analytics Platform -> Snowcap Data Warehouse License.
    in_entity_id: SYS.analyticsPlatform,
    out_entity_id: K.snowcapWarehouseLicense,
    data: { purpose: 'license', allocation: 100 },
    created_at: now,
    updated_at: now
  }
];
