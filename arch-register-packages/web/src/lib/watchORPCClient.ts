import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { createORPCClient } from '@orpc/client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { fetchWithAuthResponse } from '../auth/authClient';
import { watchContract } from '@arch-register/api-types/watchContract';
import { WatchedEntity } from '@arch-register/api-types/notifications';

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

const watchClientLink = new OpenAPILink(watchContract, {
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

const watchClient: JsonifiedClient<ContractRouterClient<typeof watchContract>> =
  createORPCClient(watchClientLink);

export const listWatchingORPC = async (workspace: string) =>
  await watchClient.watching.list({ workspace });

export const listNotificationsORPC = async (workspace: string) =>
  await watchClient.notifications.list({ workspace });

export const getNotificationCountORPC = async (workspace: string) =>
  await watchClient.notifications.count({ workspace });

export const createWatchORPC = async (
  workspace: string,
  entity_id: string
): Promise<WatchedEntity> => await watchClient.watching.create({ workspace, entity_id });

export const deleteWatchORPC = async (
  workspace: string,
  entityId: string
): Promise<{ success: boolean; message: string }> =>
  await watchClient.watching.remove({ workspace, entityId });

export const deleteNotificationORPC = async (
  workspace: string,
  notificationId: string
): Promise<{ success: boolean; message: string }> =>
  await watchClient.notifications.remove({ workspace, notificationId });

export const clearNotificationsORPC = async (
  workspace: string
): Promise<{ success: boolean; count: number }> =>
  await watchClient.notifications.clear({ workspace });
