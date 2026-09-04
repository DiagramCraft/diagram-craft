import { randomUUID } from 'node:crypto';
import type { UserDbCreate } from '../../domain/auth/db/authDatabase';
import type {
  CategoryDbCreate,
  EntityDbCreate,
  EntityGrantDbCretae,
  SchemaDbCreate
} from '../../domain/catalog/db/catalogDatabase';
import type { ProjectDbCreate } from '../../domain/project/db/projectDatabase';
import type {
  MemberDbResult,
  TeamMembershipDbResult,
  WorkspaceDbCreate
} from '../../domain/workspace/db/workspaceDatabase';
import { hashPassword } from '../../utils/password';
import type { DatabaseAdapter } from '../database';

export type FixtureWorkspaceOverrides = Partial<WorkspaceDbCreate>;

export const createFixtureWorkspace = async (
  db: DatabaseAdapter,
  overrides: FixtureWorkspaceOverrides = {}
): Promise<string> => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  await db.workspace.createWorkspace({
    name: `Workspace ${id}`,
    url_slug: id,
    short_code: 'WS',
    color: '#000000',
    description: '',
    ...overrides,
    id,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
  return id;
};

export type FixtureCategoryOverrides = Partial<Omit<CategoryDbCreate, 'workspace'>>;

export const createFixtureCategory = async (
  db: DatabaseAdapter,
  workspace: string,
  overrides: FixtureCategoryOverrides = {}
): Promise<string> => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  await db.catalog.createCategory({
    name: `Category ${id}`,
    ...overrides,
    id,
    workspace,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
  return id;
};

export type FixtureSchemaOverrides = Partial<Omit<SchemaDbCreate, 'workspace'>>;

export const createFixtureSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  overrides: FixtureSchemaOverrides = {}
): Promise<string> => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  await db.catalog.createSchema({
    name: `Schema ${id}`,
    description: '',
    fields: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 8).toUpperCase(),
    ...overrides,
    id,
    workspace,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
  return id;
};

export type FixtureEntityOverrides = Partial<Omit<EntityDbCreate, 'workspace' | 'schema_id'>>;

export const createFixtureEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  overrides: FixtureEntityOverrides = {}
) => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  return db.catalog.createEntity({
    public_id: `PUB-${id}`,
    slug: id,
    namespace: 'default',
    name: `Entity ${id}`,
    description: '',
    owner: null,
    lifecycle: null,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: [],
    links: [],
    data: {},
    project_id: null,
    completeness: 0,
    ...overrides,
    id,
    workspace,
    schema_id: schemaId,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
};

export type FixtureProjectOverrides = Partial<Omit<ProjectDbCreate, 'workspace'>>;

export const createFixtureProject = async (
  db: DatabaseAdapter,
  workspace: string,
  overrides: FixtureProjectOverrides = {}
) => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  return db.project.projects.createProject({
    name: `Project ${id}`,
    description: '',
    owner: null,
    status: 'active',
    color: null,
    start_date: null,
    target_date: null,
    pinned: false,
    ...overrides,
    id,
    workspace,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
};

export type FixtureUserOverrides = Partial<
  Omit<UserDbCreate, 'id' | 'password_hash' | 'created_at' | 'updated_at'>
> & {
  id?: string;
  password?: string;
  password_hash?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export const createFixtureUser = async (
  db: DatabaseAdapter,
  overrides: FixtureUserOverrides = {}
) => {
  const id = overrides.id ?? randomUUID();
  const createdAt = overrides.created_at ?? new Date();
  const passwordHash =
    overrides.password === undefined
      ? (overrides.password_hash ?? null)
      : await hashPassword(overrides.password);
  const { password: _password, password_hash: _passwordHash, ...userOverrides } = overrides;

  return db.auth.createUser({
    email: `${id}@example.com`,
    display_name: `User ${id}`,
    auth_provider: 'local',
    oidc_issuer: null,
    oidc_subject: null,
    is_active: true,
    color: null,
    last_login_at: null,
    ...userOverrides,
    id,
    password_hash: passwordHash,
    created_at: createdAt,
    updated_at: overrides.updated_at ?? createdAt
  });
};

export type FixtureWorkspaceMemberOverrides = Partial<
  Omit<MemberDbResult, 'workspace' | 'user_id'>
>;

export const buildFixtureWorkspaceMember = (
  workspace: string,
  userId: string,
  overrides: FixtureWorkspaceMemberOverrides = {}
): MemberDbResult => ({
  workspace,
  user_id: userId,
  role: 'editor',
  created_at: new Date(),
  ...overrides
});

export type FixtureTeamMembershipOverrides = Partial<
  Omit<TeamMembershipDbResult, 'workspace' | 'team_id' | 'user_id'>
>;

export const buildFixtureTeamMembership = (
  workspace: string,
  teamId: string,
  userId: string,
  overrides: FixtureTeamMembershipOverrides = {}
): TeamMembershipDbResult => ({
  workspace,
  team_id: teamId,
  user_id: userId,
  role: 'team_editor',
  created_at: new Date(),
  ...overrides
});

export type FixtureEntityGrantOverrides = Partial<
  Omit<EntityGrantDbCretae, 'id' | 'workspace' | 'entity_id' | 'principal_type' | 'principal_id'>
>;

export const buildFixtureEntityGrant = (
  workspace: string,
  entityId: string,
  principalType: EntityGrantDbCretae['principal_type'],
  principalId: string,
  overrides: FixtureEntityGrantOverrides = {}
): EntityGrantDbCretae => ({
  id: randomUUID(),
  workspace,
  entity_id: entityId,
  principal_type: principalType,
  principal_id: principalId,
  role: 'editor',
  applies_to: 'self',
  created_at: new Date(),
  ...overrides
});

export type ProjectFixtures = {
  workspace: string;
  schema: string;
  entity: string;
  project: string;
};

export const createFullFixtureSet = async (db: DatabaseAdapter): Promise<ProjectFixtures> => {
  const workspace = await createFixtureWorkspace(db);
  const schema = await createFixtureSchema(db, workspace);
  const entity = (await createFixtureEntity(db, workspace, schema)).id;
  const project = (await createFixtureProject(db, workspace)).id;
  return { workspace, schema, entity, project };
};
