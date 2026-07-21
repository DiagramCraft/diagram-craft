import { randomUUID } from 'node:crypto';
import { WORKSPACE_ROLE_CAPABILITIES, type WorkspaceCapability } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { httpAssert } from '../../utils/httpAssert';
import { buildApiAuthCtx, requireWorkspaceCapability } from './authorization';
import { generateApiToken, toApiToken } from './apiTokens';
import { resolveWorkspace } from '../workspace/resolveWorkspace';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { recordApiTokenAudit } from './apiTokenAudit';

const EDITOR_CAPABILITIES = new Set<WorkspaceCapability>([
  ...WORKSPACE_ROLE_CAPABILITIES.editor,
  'ent.external_update'
]);
export const MAX_API_TOKENS_PER_WORKSPACE = 10;

const getOneYearFrom = (date: Date) => {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
};

type CreateApiTokenInput = {
  name: string;
  capabilities: WorkspaceCapability[];
  expires_at?: string | null;
};

const parseCreateInput = (input: CreateApiTokenInput, now: Date) => {
  const name = input.name.trim();
  httpAssert.true(name.length > 0 && name.length <= 100, {
    status: 400,
    message: 'name must be between 1 and 100 characters'
  });

  const capabilities = [...new Set(input.capabilities)];
  httpAssert.true(capabilities.length > 0, {
    status: 400,
    message: 'At least one capability is required'
  });
  httpAssert.true(
    capabilities.every(capability => EDITOR_CAPABILITIES.has(capability)),
    {
      status: 400,
      message: 'API tokens may only use editor capabilities'
    }
  );

  const maximumExpiresAt = getOneYearFrom(now);
  let expiresAt = maximumExpiresAt;
  if (input.expires_at != null) {
    expiresAt = new Date(input.expires_at);
    httpAssert.true(!Number.isNaN(expiresAt.getTime()), {
      status: 400,
      message: 'expires_at must be a valid ISO 8601 timestamp'
    });
    httpAssert.true(expiresAt > now, {
      status: 400,
      message: 'expires_at must be in the future'
    });
    httpAssert.true(expiresAt <= maximumExpiresAt, {
      status: 400,
      message: 'expires_at cannot be more than one year from now'
    });
  }

  return { name, capabilities, expiresAt };
};

const createToken = async (
  db: DatabaseAdapter,
  workspace: string,
  input: CreateApiTokenInput,
  event: AuthenticatedEvent,
  authCtx: WorkspaceAuthorizationContext
) => {
  const now = new Date();
  const parsed = parseCreateInput(input, now);
  for (const capability of parsed.capabilities) {
    requireWorkspaceCapability(authCtx, capability);
  }

  const tokenCount = await db.auth.countApiTokens(workspace, event.context.user.id);
  httpAssert.true(tokenCount < MAX_API_TOKENS_PER_WORKSPACE, {
    status: 409,
    message: `Users may have at most ${MAX_API_TOKENS_PER_WORKSPACE} API tokens per workspace`
  });

  const { token, tokenHash } = generateApiToken();
  const created = await db.auth.createApiToken({
    id: randomUUID(),
    workspace,
    name: parsed.name,
    token_hash: tokenHash,
    capabilities: parsed.capabilities,
    created_by: event.context.user.id,
    created_at: now,
    last_used_at: null,
    expires_at: parsed.expiresAt
  });

  await recordApiTokenAudit(db.auth, {
    workspace,
    tokenId: created.id,
    userId: event.context.user.id,
    event: 'created',
    metadata: {
      name: created.name,
      capabilities: created.capabilities,
      expires_at: created.expires_at?.toISOString() ?? null
    }
  });

  return { ...toApiToken(created), token };
};

export const listApiTokens = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');
  return (await db.auth.listApiTokens(workspace)).map(toApiToken);
};

export const createApiToken = async (
  db: DatabaseAdapter,
  workspace: string,
  input: CreateApiTokenInput,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');
  return createToken(db, workspace, input, event, authCtx);
};

export const listUserApiTokens = async (db: DatabaseAdapter, event: AuthenticatedEvent) => {
  return (await db.auth.listApiTokensByCreator(event.context.user.id)).map(toApiToken);
};

export const createUserApiToken = async (
  db: DatabaseAdapter,
  input: CreateApiTokenInput & { workspace: string },
  event: AuthenticatedEvent
) => {
  const workspace = await resolveWorkspace(db.catalog, input.workspace);
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  return createToken(db, workspace, input, event, authCtx);
};

export const revokeUserApiToken = async (
  db: DatabaseAdapter,
  id: string,
  event: AuthenticatedEvent
) => {
  const revoked = await db.auth.deleteApiTokenByCreator(event.context.user.id, id);
  httpAssert.present(revoked, { status: 404, message: 'API token not found' });
  await recordApiTokenAudit(db.auth, {
    workspace: revoked.workspace,
    tokenId: revoked.id,
    userId: event.context.user.id,
    event: 'revoked',
    metadata: { name: revoked.name }
  });
  return toApiToken(revoked);
};

export const revokeApiToken = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
) => {
  const authCtx = await buildApiAuthCtx(db, workspace, event);
  requireWorkspaceCapability(authCtx, 'people.role');

  const revoked = await db.auth.deleteApiToken(workspace, id);
  httpAssert.present(revoked, { status: 404, message: 'API token not found' });
  await recordApiTokenAudit(db.auth, {
    workspace,
    tokenId: revoked.id,
    userId: event.context.user.id,
    event: 'revoked',
    metadata: { name: revoked.name }
  });
  return toApiToken(revoked);
};
