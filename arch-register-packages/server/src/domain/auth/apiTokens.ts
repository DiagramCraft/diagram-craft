import { createHash, randomBytes } from 'node:crypto';
import type { WorkspaceCapability } from '@arch-register/permissions';
import type { ApiTokenDbResult } from './db/authDatabase';

export const API_TOKEN_PREFIX = 'ar_pat_';

export type ApiTokenPrincipal = {
  type: 'api_token';
  id: string;
  workspace: string;
  capabilities: WorkspaceCapability[];
  created_by: string;
};

export const generateApiToken = () => {
  const token = `${API_TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`;
  return { token, tokenHash: hashApiToken(token) };
};

export const hashApiToken = (token: string) =>
  createHash('sha256').update(token, 'utf8').digest('hex');

export const toApiToken = (token: ApiTokenDbResult) => ({
  id: token.id,
  workspace: token.workspace,
  name: token.name,
  capabilities: token.capabilities as WorkspaceCapability[],
  created_by: token.created_by,
  created_at: token.created_at.toISOString(),
  last_used_at: token.last_used_at?.toISOString() ?? null,
  expires_at: token.expires_at?.toISOString() ?? null
});

export const toApiTokenPrincipal = (token: ApiTokenDbResult): ApiTokenPrincipal => ({
  type: 'api_token',
  id: token.id,
  workspace: token.workspace,
  capabilities: token.capabilities as WorkspaceCapability[],
  created_by: token.created_by
});
