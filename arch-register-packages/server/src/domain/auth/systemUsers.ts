// Central registry of "system users" — seeded `users` rows with `is_system_actor: true`
// used to attribute writes where no real user applies. New use cases should add an
// entry here and call getSystemUserId(key) instead of hand-picking another raw UUID.
//
// Any future admin-facing user deactivation/deletion endpoint MUST check
// isSystemUserId (or the row's own is_system_actor flag) before acting — see the
// replaceGlobalRoles guardrail in authOrpc.ts for the existing precedent.
export type SystemUserKey = 'ai-metadata-generator' | 'technology-eol-job' | 'workspace-token-owner';

type SystemUserDefinition = {
  id: string;
  userId: string;
  displayName: string;
  description: string;
};

const SYSTEM_USERS: Record<SystemUserKey, SystemUserDefinition> = {
  'ai-metadata-generator': {
    id: '00000000-0000-0000-0000-0000000000a1',
    userId: 'system:ai-metadata-generator',
    displayName: 'AI Metadata Generator',
    description: 'Attributes AI-generated entity/document metadata (migration 055).'
  },
  'technology-eol-job': {
    // Deliberately the same row as ai-metadata-generator — technologyEolJob.ts
    // reused the seeded a1 user rather than seeding its own. Kept as a distinct
    // registry key so the two call sites can evolve independently later.
    id: '00000000-0000-0000-0000-0000000000a1',
    userId: 'system:ai-metadata-generator',
    displayName: 'AI Metadata Generator',
    description: 'Attributes technology EOL tracking job writes (migration 055).'
  },
  'workspace-token-owner': {
    id: '00000000-0000-0000-0000-0000000000a3',
    userId: 'system:workspace-token-owner',
    displayName: 'Workspace',
    description:
      'Owner of API tokens created via Workspace Admin > API Tokens, so they keep working regardless of which admin created them (migration 057).'
  }
};

export const getSystemUserId = (key: SystemUserKey): string => SYSTEM_USERS[key].id;

export const isSystemUserId = (id: string): boolean =>
  Object.values(SYSTEM_USERS).some(u => u.id === id);
