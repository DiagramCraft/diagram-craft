import type { Config, Decision } from './config.js';
import type {
  ArchRegisterClient,
  GovernanceDecisionResult,
  GovernanceInboxItem
} from './archRegister.js';

export type GovernanceWebhookEvent = {
  version: '1';
  id: string;
  type: 'governance.workflow.started';
  operation: 'governance.workflow.started';
  occurred_at: string;
  workspace_id: string;
  governance: {
    case: {
      id: string;
      kind: string;
      subject_type: string;
      subject_id: string;
      status: string;
      outcome: string | null;
      external: boolean;
      initiation_fields: unknown[];
    };
    event: { id: string; event_type: string };
    assignment_id: string | null;
  };
};

export type IntegrationResult = {
  status: 'ignored' | 'created' | 'decided';
  caseId?: string;
  assignmentId?: string;
  decision?: Exclude<Decision, 'none'>;
  decisionResult?: GovernanceDecisionResult;
};

export const processWebhookEvent = async (
  event: GovernanceWebhookEvent,
  config: Config,
  client: ArchRegisterClient
): Promise<IntegrationResult> => {
  if (event.governance.case.external !== true) return { status: 'ignored' };

  const inboxItem: GovernanceInboxItem = await client.createInboxItem(
    event.governance.case.id,
    config.targetCapability,
    config.assignmentAction,
    `external-governance:inbox:${event.id}`
  );

  if (config.autoDecision === 'none') {
    return {
      status: 'created',
      caseId: event.governance.case.id,
      assignmentId: inboxItem.assignment.id
    };
  }

  const decisionResult = await client.decideInboxItem(
    inboxItem.assignment.id,
    config.autoDecision,
    config.decisionReason,
    `external-governance:decision:${event.id}:${config.autoDecision}`
  );

  return {
    status: 'decided',
    caseId: event.governance.case.id,
    assignmentId: inboxItem.assignment.id,
    decision: config.autoDecision,
    decisionResult
  };
};
