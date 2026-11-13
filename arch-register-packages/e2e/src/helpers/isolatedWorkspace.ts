import { randomUUID } from 'node:crypto';
import type { createTestORPCClient } from './fixtures';

type TestClient = ReturnType<typeof createTestORPCClient>;

export const randomBadge = () =>
  Array.from({ length: 5 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join(
    ''
  );

/** Creates a uniquely named workspace so a test can change schemas without affecting others. */
export const createIsolatedWorkspace = (orpc: TestClient, label: string) =>
  orpc.workspaces.create({ body: { name: `${label} ${randomUUID()}`, badge: randomBadge() } });
