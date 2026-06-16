// Fixed UUIDs for test fixtures. Using valid-UUID strings with an 'e2e' marker in them.
// These replace the old human-readable string IDs that only worked with SQLite.

// Shared fixtures (seedHelper / permissionFixtures)
export const TEST_ADMIN_ID = '00000000-0000-0000-0000-e2e000000001';
export const OUTSIDER_USER_ID = '00000000-0000-0000-0000-e2e000000002';
export const EXPLICIT_GRANT_USER_ID = '00000000-0000-0000-0000-e2e000000003';

// auth.test.ts fixtures
export const INACTIVE_USER_ID = '00000000-0000-0000-0001-e2e000000001';
export const ROLES_USER_ID = '00000000-0000-0000-0001-e2e000000002';
export const ROLES_INVALID_USER_ID = '00000000-0000-0000-0001-e2e000000003';

// ai-chat.test.ts fixtures (workspace id shared with diagram-craft.test.ts)
export const OTHER_AI_USER_ID = '00000000-0000-0000-0002-e2e000000001';
export const NO_AI_WORKSPACE_ID = '00000000-0000-0000-0002-e2e000000002';
export const AI_CONV_1_ID = '00000000-0000-0000-0002-e2e000000003';
export const AI_MSG_1_ID = '00000000-0000-0000-0002-e2e000000004';
export const AI_CONV_OTHER_ID = '00000000-0000-0000-0002-e2e000000005';

// search.test.ts fixtures
export const SEARCH_PROJ_ALPHA_ID = '00000000-0000-0000-0003-e2e000000001';
export const SEARCH_PROJ_BETA_ID = '00000000-0000-0000-0003-e2e000000002';

// notifications.test.ts fixtures
export const TEST_EDITOR_ID = '00000000-0000-0000-0004-e2e000000001';

// projects.permissions.test.ts fixtures
export const PERMISSIONS_DESIGN_ONLY_ID = '00000000-0000-0000-0005-e2e000000001';

// workspace-config.test.ts fixtures
export const CONFIG_USER_ID = '00000000-0000-0000-0006-e2e000000001';
export const CONFIG_REMOVE_USER_ID = '00000000-0000-0000-0006-e2e000000002';

// templates.test.ts fixtures
export const TMPL_PROJ_A_ID = '00000000-0000-0000-0007-e2e000000001';
export const TMPL_PROJ_B_ID = '00000000-0000-0000-0007-e2e000000002';

// audit.test.ts fixtures (entity_id values — no FK constraint, but must be valid UUID format)
export const AUDIT_ENTITY_1_ID = '00000000-0000-0000-0008-e2e000000001';
export const AUDIT_ENTITY_2_ID = '00000000-0000-0000-0008-e2e000000002';
export const AUDIT_PROJ_1_ID = '00000000-0000-0000-0008-e2e000000003';
