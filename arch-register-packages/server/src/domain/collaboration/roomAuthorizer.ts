import type { IncomingMessage } from 'node:http';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  buildWorkspaceAuthorizationContext,
  fetchWorkspaceAuthorizationContextData
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { ServerDataProvider } from '../auth/ServerAuthorizationDataProvider';
import { canAccessNonProjectContent, canAccessProject } from '../auth/authorization';
import { verifyToken } from '../../utils/jwt';
import type { JWTPayload } from '../../types';
import { parseRoomPath } from './roomPath';

export type RoomGrant = {
  userId: string;
  workspace: string;
  storageScope: string;
  fileId: string;
  readOnly: boolean;
  tokenExpiresAt: number;
};

export type RoomAuthorizationResult = { grant: RoomGrant } | { status: 401 | 403 };

export type RoomAuthorizer = (
  request: IncomingMessage,
  roomName: string
) => Promise<RoomAuthorizationResult>;

const unauthorized = (): RoomAuthorizationResult => ({ status: 401 });
const forbidden = (): RoomAuthorizationResult => ({ status: 403 });

const getAccessToken = (request: IncomingMessage) => {
  const cookieHeader = request.headers.cookie ?? '';
  return cookieHeader.match(/(?:^|;\s*)ar_access_token=([^;]*)/)?.[1];
};

const buildContext = async (
  db: DatabaseAdapter,
  workspace: string,
  userId: string
): Promise<WorkspaceAuthorizationContext> => {
  const data = await fetchWorkspaceAuthorizationContextData(
    new ServerDataProvider(db),
    workspace,
    userId
  );
  return buildWorkspaceAuthorizationContext(data);
};

export const createRoomAuthorizer = (db: DatabaseAdapter): RoomAuthorizer => {
  return async (request, roomName) => {
    const token = getAccessToken(request);
    if (!token) return unauthorized();

    let payload: JWTPayload;
    try {
      payload = verifyToken(token);
    } catch {
      return unauthorized();
    }

    if (payload.type !== 'access' || !Number.isFinite(payload.exp)) return unauthorized();

    const user = await db.auth.getUser(payload.sub);
    if (!user) return unauthorized();
    if (!user.is_active) return forbidden();

    const parsed = parseRoomPath(roomName);
    if (!parsed) return forbidden();

    const workspace = await db.catalog.resolveWorkspaceSlug(parsed.workspaceSlug);
    if (!workspace) return forbidden();

    const node = await db.project.getAnyContentNodeById(workspace, parsed.fileId);
    if (!node) return forbidden();

    const authCtx = await buildContext(db, workspace, user.id);
    if (node.project_id) {
      const project = await db.project.getProject(workspace, node.project_id);
      if (!project || !canAccessProject(authCtx, project.owner)) return forbidden();
    } else if (!canAccessNonProjectContent(authCtx, 'read')) {
      return forbidden();
    }

    return {
      grant: {
        userId: user.id,
        workspace,
        storageScope: node.project_id ?? node.entity_id ?? workspace,
        fileId: node.id,
        readOnly: node.mount_id != null,
        tokenExpiresAt: payload.exp
      }
    };
  };
};
