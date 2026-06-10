import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { auditContract } from '@arch-register/api-types';
import { fetchWithAuthResponse } from '../auth/authClient';

const ORPC_BASE_PATH = '/api';

const resolveORPCBaseUrl = () => {
  const configuredBase = import.meta.env.VITE_API_URL ?? '';

  if (configuredBase) {
    return new URL(ORPC_BASE_PATH, configuredBase).toString();
  }

  if (typeof window !== 'undefined') {
    return new URL(ORPC_BASE_PATH, window.location.origin).toString();
  }

  return `http://localhost${ORPC_BASE_PATH}`;
};

const auditClientLink = new OpenAPILink(auditContract, {
  url: resolveORPCBaseUrl,
  fetch: async (request, init) => {
    const raw = request.url;
    const method = request.method;
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.clone().text();
    const nextInit: RequestInit = { ...init, method, headers: request.headers, body };

    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const url = new URL(raw);
      return fetchWithAuthResponse(`${url.pathname}${url.search}`, nextInit);
    }

    return fetchWithAuthResponse(raw, nextInit);
  }
});

const auditClient: JsonifiedClient<ContractRouterClient<typeof auditContract>> =
  createORPCClient(auditClientLink);

export const listAuditLogORPC = async (
  workspace: string,
  options: {
    entityType?: string | null;
    entityId?: string | null;
    operation?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    limit?: number | null;
    offset?: number | null;
  } = {}
) =>
  await auditClient.audit.list({
    workspace,
    entityType: options.entityType ?? undefined,
    entityId: options.entityId ?? undefined,
    operation: options.operation ?? undefined,
    startDate: options.startDate ?? undefined,
    endDate: options.endDate ?? undefined,
    limit: options.limit ?? undefined,
    offset: options.offset ?? undefined
  });

export const getAuditStatsORPC = async (workspace: string) =>
  await auditClient.audit.stats({ workspace });
