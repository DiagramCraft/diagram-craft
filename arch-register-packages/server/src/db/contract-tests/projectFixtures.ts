import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../database';

export const createFixtureWorkspace = async (db: DatabaseAdapter, id = randomUUID()) => {
  const now = new Date();
  await db.workspace.createWorkspace({
    id,
    name: `Workspace ${id}`,
    url_slug: id,
    short_code: 'WS',
    color: '#000000',
    description: '',
    created_at: now,
    updated_at: now
  });
  return id;
};

export const createFixtureSchema = async (
  db: DatabaseAdapter,
  workspace: string,
  id = randomUUID()
) => {
  const now = new Date();
  await db.catalog.createSchema({
    id,
    workspace,
    name: `Schema ${id}`,
    description: '',
    fields: [],
    color: null,
    icon: null,
    default_owner: null,
    key_prefix: id.slice(0, 8).toUpperCase(),
    created_at: now,
    updated_at: now
  });
  return id;
};

export const createFixtureEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  schemaId: string,
  id = randomUUID()
) => {
  const now = new Date();
  return db.catalog.createEntity({
    id,
    workspace,
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
    schema_id: schemaId,
    data: {},
    project_id: null,
    created_at: now,
    updated_at: now,
    completeness: 0
  });
};

export const createFixtureProject = async (
  db: DatabaseAdapter,
  workspace: string,
  id = randomUUID()
) => {
  const now = new Date();
  return db.project.createProject({
    id,
    workspace,
    name: `Project ${id}`,
    description: '',
    owner: null,
    status: 'active',
    color: null,
    target_date: null,
    pinned: false,
    created_at: now,
    updated_at: now
  });
};

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
