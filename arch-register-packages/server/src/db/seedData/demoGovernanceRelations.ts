import type { RelationDbCreate } from '../../domain/catalog/db/relationDatabase';
import {
  CONTROL_REQUIREMENT_SCHEMA_ID,
  DEMO_RETENTION_IDS,
  DEMO_RISK_COMPLIANCE_IDS,
  RETENTION_IDS,
  RISK_AFFECTS_RELATION_SCHEMA_ID,
  RISK_CONTROL_SCHEMA_ID,
  WORKSPACE_ID,
  now
} from './constants';

// Relations wiring the demo governance content (demoGovernanceEntities.ts) together: Risk
// -risk-control-> Control -control-requirement-> Compliance Requirement, Risk -risk-affects->
// architecture entity, and entity -retention-assignment-> Retention Policy. Replaces the relations
// for the test dataset's risk/control/framework/complianceRequirement/retentionPolicy content
// (relations.ts:149-315,382-418).
export const demoGovernanceRelations: RelationDbCreate[] = [
  // Risk Mitigation (risk -> control)
  {
    id: '00000000-0000-0000-0013-000000000201',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.customerAccountTakeover,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.mfaEnforcement,
    data: { effectiveness: 'partial', coverage: 70, reviewed_on: '2026-01-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000202',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.undetectedDataExfiltration,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.siemAlerting,
    data: { effectiveness: 'substantial', coverage: 85, reviewed_on: '2025-11-15' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000203',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.plaintextCustomerPiiAtRest,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.encryptionAtRest,
    data: { effectiveness: 'full', coverage: 100, reviewed_on: '2025-12-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000204',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.thirdPartyVendorDataBreach,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.vendorSecurityReview,
    data: { effectiveness: 'partial', coverage: 60, reviewed_on: '2025-10-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000205',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.paymentCardDataBreach,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.cardholderDataTokenization,
    data: { effectiveness: 'substantial', coverage: 90, reviewed_on: '2025-12-15' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000206',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.unauthorizedAccessToPaymentLogs,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.paymentAccessLogging,
    data: { effectiveness: 'substantial', coverage: 90, reviewed_on: '2025-11-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000207',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.unauthorizedInternalPiiAccess,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.piiAccessControls,
    data: { effectiveness: 'substantial', coverage: 85, reviewed_on: '2025-12-20' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0013-000000000208',
    workspace: WORKSPACE_ID,
    schema_id: RISK_CONTROL_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.nonCompliantErasureRequests,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.dataDeletionAutomation,
    data: { effectiveness: 'partial', coverage: 50, reviewed_on: '2025-09-01' },
    created_at: now,
    updated_at: now
  },

  // Control Compliance (control -> compliance requirement)
  {
    id: '00000000-0000-0000-0014-000000000201',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.mfaEnforcement,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.soc2LogicalAccess,
    data: {
      status: 'met',
      evidence: 'MFA policy and access log review',
      verified_on: '2026-01-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000202',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.siemAlerting,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.soc2SystemMonitoring,
    data: { status: 'met', evidence: 'SIEM alert configuration review', verified_on: '2025-11-15' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000203',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.encryptionAtRest,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.iso27001Cryptography,
    data: {
      status: 'met',
      evidence: 'Encryption standards and storage configuration review',
      verified_on: '2025-12-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000204',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.vendorSecurityReview,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.iso27001SupplierSecurity,
    data: {
      status: 'in-progress',
      evidence: 'Annual vendor security questionnaire',
      verified_on: '2025-10-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000205',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.cardholderDataTokenization,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.pciProtectCardholderData,
    data: { status: 'met', evidence: 'Tokenization vendor attestation', verified_on: '2025-12-15' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000206',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.paymentAccessLogging,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.pciTrackMonitorAccess,
    data: {
      status: 'met',
      evidence: 'Payment access log sampling review',
      verified_on: '2025-11-01'
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000207',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.piiAccessControls,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.gdprSecurityOfProcessing,
    data: { status: 'in-progress', evidence: 'RBAC policy review', verified_on: '2025-12-20' },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0014-000000000208',
    workspace: WORKSPACE_ID,
    schema_id: CONTROL_REQUIREMENT_SCHEMA_ID,
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.controls.dataDeletionAutomation,
    out_entity_id: DEMO_RISK_COMPLIANCE_IDS.complianceRequirements.gdprRightToErasure,
    data: {
      status: 'not-applicable',
      evidence: 'Automation not yet in production',
      verified_on: '2025-09-01'
    },
    created_at: now,
    updated_at: now
  },

  // Risk Affects (risk -> architecture entity)
  {
    id: '00000000-0000-0000-0015-000000000201',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Customer Account Takeover -> Identity Platform.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.customerAccountTakeover,
    out_entity_id: '00000000-0000-0000-0002-000000000002',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000202',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Customer Account Takeover -> Customer Portal.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.customerAccountTakeover,
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000203',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Undetected Data Exfiltration -> Analytics Platform.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.undetectedDataExfiltration,
    out_entity_id: '00000000-0000-0000-0002-000000000004',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000204',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Undetected Data Exfiltration -> Clickstream Events.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.undetectedDataExfiltration,
    out_entity_id: '00000000-0000-0000-0008-000000000003',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000205',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Plaintext Customer PII at Rest -> Postgres Main.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.plaintextCustomerPiiAtRest,
    out_entity_id: '00000000-0000-0000-0005-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000206',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Plaintext Customer PII at Rest -> Customer Credentials.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.plaintextCustomerPiiAtRest,
    out_entity_id: '00000000-0000-0000-0008-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000207',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Third-Party Vendor Data Breach -> Acme Cloud.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.thirdPartyVendorDataBreach,
    out_entity_id: '00000000-0000-0000-000b-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000208',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Payment Card Data Breach -> Payments Platform.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.paymentCardDataBreach,
    out_entity_id: '00000000-0000-0000-0002-000000000003',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-000000000209',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Unauthorized Access to Payment Transaction Logs -> Payments Platform.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.unauthorizedAccessToPaymentLogs,
    out_entity_id: '00000000-0000-0000-0002-000000000003',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-00000000020a',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Unauthorized Internal Access to Customer PII -> Customer Portal.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.unauthorizedInternalPiiAccess,
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-00000000020b',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Unauthorized Internal Access to Customer PII -> Customer Credentials.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.unauthorizedInternalPiiAccess,
    out_entity_id: '00000000-0000-0000-0008-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0015-00000000020c',
    workspace: WORKSPACE_ID,
    schema_id: RISK_AFFECTS_RELATION_SCHEMA_ID,
    // Non-Compliant Data Subject Erasure Requests -> Customer Portal.
    in_entity_id: DEMO_RISK_COMPLIANCE_IDS.risks.nonCompliantErasureRequests,
    out_entity_id: '00000000-0000-0000-0002-000000000001',
    data: {},
    created_at: now,
    updated_at: now
  },

  // Retention assignments (entity -> retention policy)
  {
    id: DEMO_RETENTION_IDS.assignments.transactionEvents,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Transaction Events (Data Entity DE-2) -> Payment Transaction Records, well past its 7-year
    // expiry (demonstrates the "expired" status).
    in_entity_id: '00000000-0000-0000-0008-000000000002',
    out_entity_id: DEMO_RETENTION_IDS.policies.paymentTransactionRecords,
    data: { activated_from: '2017-01-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: DEMO_RETENTION_IDS.assignments.customerCredentials,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Customer Credentials (Data Entity DE-1) -> Customer PII Records, approaching its 3-year
    // expiry.
    in_entity_id: '00000000-0000-0000-0008-000000000001',
    out_entity_id: DEMO_RETENTION_IDS.policies.customerPiiRecords,
    data: { activated_from: '2023-06-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: DEMO_RETENTION_IDS.assignments.clickstreamEvents,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Clickstream Events (Data Entity DE-3) -> Marketing Consent Records, recently activated.
    in_entity_id: '00000000-0000-0000-0008-000000000003',
    out_entity_id: DEMO_RETENTION_IDS.policies.marketingConsentRecords,
    data: { activated_from: '2025-06-01' },
    created_at: now,
    updated_at: now
  },
  {
    id: DEMO_RETENTION_IDS.assignments.paymentsPlatform,
    workspace: WORKSPACE_ID,
    schema_id: RETENTION_IDS.assignmentRelationSchema,
    // Payments Platform -> Order & Fulfillment Records.
    in_entity_id: '00000000-0000-0000-0002-000000000003',
    out_entity_id: DEMO_RETENTION_IDS.policies.orderFulfillmentRecords,
    data: { activated_from: '2022-01-01' },
    created_at: now,
    updated_at: now
  }
];
