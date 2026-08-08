import type { Config, Decision } from './config.js';

export type GovernanceInboxItem = {
  assignment: {
    id: string;
    caseId: string;
    action: string;
    status: string;
  };
  case: { id: string; status: string; outcome: string | null };
};

export type GovernanceDecisionResult = {
  case: { id: string; status: string; outcome: string | null };
  event: { id: string; eventType: string };
};

export class ArchRegisterApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ArchRegisterApiError';
  }
}

export type ArchRegisterFetch = typeof fetch;

const readObject = async (response: Response): Promise<Record<string, unknown>> => {
  const body: unknown = await response.json().catch(() => null);
  const bodyRecord =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (!response.ok) {
    const detail = typeof bodyRecord?.['message'] === 'string' ? `: ${bodyRecord['message']}` : '';
    throw new ArchRegisterApiError(
      `Arch Register returned HTTP ${response.status}${detail}`,
      response.status
    );
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ArchRegisterApiError(
      'Arch Register returned an invalid JSON response',
      response.status
    );
  }
  return body as Record<string, unknown>;
};

export class ArchRegisterClient {
  private readonly apiBase: string;

  constructor(
    private readonly config: Config,
    private readonly fetchImpl: ArchRegisterFetch = fetch
  ) {
    this.apiBase = `${config.archRegisterUrl}/api/integrations/v1/${encodeURIComponent(config.workspace)}`;
  }

  async createInboxItem(
    caseId: string,
    targetCapability: string,
    action: Config['assignmentAction'],
    idempotencyKey: string
  ): Promise<GovernanceInboxItem> {
    const response = await this.fetchImpl(
      `${this.apiBase}/governance/cases/${encodeURIComponent(caseId)}/inbox-items`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          action,
          target: { type: 'capability', capability: targetCapability },
          idempotencyKey
        })
      }
    );
    return (await readObject(response)) as unknown as GovernanceInboxItem;
  }

  async decideInboxItem(
    assignmentId: string,
    decision: Exclude<Decision, 'none'>,
    reason: string,
    idempotencyKey: string
  ): Promise<GovernanceDecisionResult> {
    const response = await this.fetchImpl(
      `${this.apiBase}/governance/inbox-items/${encodeURIComponent(assignmentId)}/decisions`,
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({ decision, reason, idempotencyKey })
      }
    );
    return (await readObject(response)) as unknown as GovernanceDecisionResult;
  }

  private headers = (): Record<string, string> => ({
    authorization: `Bearer ${this.config.archRegisterToken}`,
    'content-type': 'application/json'
  });
}
