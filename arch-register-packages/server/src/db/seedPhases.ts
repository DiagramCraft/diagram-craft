import type { AiConfigInputDbUpsert } from '../domain/ai/db/aiDatabase';
import type { Entity, SavedViewDbResult } from '../domain/catalog/db/catalogDatabase';
import type { GlobalRoleAssignmentDbResult, UserDbCreate } from '../domain/auth/db/authDatabase';
import type {
  MemberDbResult,
  TeamMembershipDbResult,
  WorkspaceDbResult
} from '../domain/workspace/db/workspaceDatabase';
import type { DatabaseAdapter } from './database';
import { seedAiConfig } from './seedData/ai';
import {
  seedAssessmentTypes,
  seedGlobalRoleAssignments,
  seedLifecycleStates,
  seedLocalUsers,
  seedOwners,
  seedProjectEntityTypes,
  seedTeamAssignments,
  seedWorkspaceMembers,
  seedWorkspaces
} from './seedData/workspace';
import { seedEntities } from './seedData/entities';
import {
  seedCategories,
  seedEnums,
  seedSchemas,
  seedSharedFieldGroups,
  seedSupportedCurrencies
} from './seedData/catalog';
import {
  SEED_CAPABILITY_CONFIGURATION_IDS,
  seedTemplateDefinitions
} from './seedData/templateDefinitions';
import { WORKSPACE_ID, now } from './seedData/constants';
import { seedGovernanceCaseConfigs } from './seedData/governanceCaseConfigs';
import { seedSavedViews } from './seedData/views';
import { seededTestPassword } from './seedFixtures';
import { hashPassword } from '../utils/password';
import { randomUUID } from 'node:crypto';

export type WorkspaceSeedOptions = {
  supportedCurrencies?: boolean;
  lifecycleStates?: boolean;
  projectEntityTypes?: boolean;
  assessmentTypes?: boolean;
  teams?: boolean;
};

export type CatalogSeedOptions = {
  enums?: boolean;
  sharedFieldGroups?: boolean;
  schemas?: boolean;
};

type SeedTemplateCapabilityConfiguration =
  (typeof seedTemplateDefinitions.capabilityConfigurations)[number];

const seedCapabilitiesWithoutRelationSchemas: SeedTemplateCapabilityConfiguration[] =
  seedTemplateDefinitions.capabilityConfigurations.filter(configuration =>
    Object.values(configuration.bindings).every(
      binding => binding.target.kind !== 'relation_schema'
    )
  );

export const seedTemplateCapabilityConfigurations = async (
  db: DatabaseAdapter,
  configurations: readonly SeedTemplateCapabilityConfiguration[] = seedCapabilitiesWithoutRelationSchemas
): Promise<void> => {
  for (const configuration of configurations) {
    const capabilityId =
      SEED_CAPABILITY_CONFIGURATION_IDS[
        configuration.type as keyof typeof SEED_CAPABILITY_CONFIGURATION_IDS
      ];
    if (!capabilityId) {
      throw new Error(`No stable seed id configured for capability '${configuration.type}'`);
    }
    await db.workspace.upsertWorkspaceCapabilityConfiguration({
      id: capabilityId,
      workspace: WORKSPACE_ID,
      type: configuration.type,
      bindings: configuration.bindings,
      created_at: now,
      updated_at: now
    });
  }
};

export const seedTemplateRelationCapabilityConfigurations = async (
  db: DatabaseAdapter
): Promise<void> => {
  await seedTemplateCapabilityConfigurations(
    db,
    seedTemplateDefinitions.capabilityConfigurations.filter(configuration =>
      Object.values(configuration.bindings).some(
        binding => binding.target.kind === 'relation_schema'
      )
    )
  );
};

export type SeedLocalUser = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string;
  color: string | null;
};

export type UsersAndRolesSeedOptions = {
  users: readonly SeedLocalUser[];
  password: string;
  teamAssignments?: readonly TeamMembershipDbResult[];
  globalRoleAssignments?: readonly GlobalRoleAssignmentDbResult[];
  workspaceMembers?: readonly MemberDbResult[];
  workspaces?: readonly Pick<WorkspaceDbResult, 'id'>[];
  createdAt?: Date;
};

export type SeedPublicIdRecord = {
  public_id?: string | null;
};

export const seedWorkspaceBase = async (
  db: DatabaseAdapter,
  workspaces: readonly WorkspaceDbResult[] = seedWorkspaces
): Promise<void> => {
  for (const workspace of workspaces) {
    await db.workspace.createWorkspace(workspace);
    await db.workspace.registerPublicIdPrefix(
      workspace.short_code,
      'workspace',
      workspace.id,
      workspace.created_at
    );
  }
};

export const seedWorkspaceConfiguration = async (
  db: DatabaseAdapter,
  options: WorkspaceSeedOptions = {}
): Promise<void> => {
  if (options.supportedCurrencies ?? true) {
    for (const workspace of seedWorkspaces) {
      const currencies = seedSupportedCurrencies.filter(
        currency => currency.workspace === workspace.id
      );
      await db.workspace.replaceSupportedCurrencies(workspace.id, currencies, currencies[0]!.code);
    }
  }

  for (const workspace of seedWorkspaces) {
    if (options.lifecycleStates ?? true) {
      await db.workspace.replaceLifecycleStates(
        workspace.id,
        seedLifecycleStates.filter(state => state.workspace === workspace.id)
      );
    }
    if (options.projectEntityTypes ?? true) {
      await db.workspace.replaceProjectEntityTypes(
        workspace.id,
        seedProjectEntityTypes.filter(type => type.workspace === workspace.id)
      );
    }
    if (options.assessmentTypes ?? true) {
      await db.workspace.replaceAssessmentTypes(
        workspace.id,
        seedAssessmentTypes.filter(type => type.workspace === workspace.id)
      );
    }
    if (options.teams ?? true) {
      await db.workspace.replaceTeams(
        workspace.id,
        seedOwners.filter(owner => owner.workspace === workspace.id)
      );
    }
  }
};

export const seedCatalogDefinitions = async (
  db: DatabaseAdapter,
  options: CatalogSeedOptions = {}
): Promise<void> => {
  for (const category of seedCategories) {
    await db.catalog.createCategory(category);
  }

  if (options.enums ?? true) {
    for (const enumeration of seedEnums) {
      await db.catalog.createEnum(enumeration);
    }
  }

  if (options.sharedFieldGroups ?? true) {
    for (const fieldGroup of seedSharedFieldGroups) {
      await db.catalog.createSharedFieldGroup(fieldGroup);
    }
  }

  if (options.schemas ?? true) {
    const categoryNamesById = new Map(seedCategories.map(category => [category.id, category.name]));
    for (const schema of seedSchemas) {
      const createdSchema = await db.catalog.createSchema(schema);
      await db.catalog.createSchemaVersion({
        id: randomUUID(),
        workspace: createdSchema.workspace,
        schema_id: createdSchema.id,
        version: createdSchema.version ?? 1,
        name: createdSchema.name,
        category:
          (createdSchema.category_id && categoryNamesById.get(createdSchema.category_id)) ?? null,
        description: createdSchema.description,
        fields: createdSchema.fields,
        templates: createdSchema.templates ?? [],
        groups: createdSchema.groups ?? [],
        shared_field_group_links: createdSchema.shared_field_group_links ?? [],
        validation_rules: createdSchema.validation_rules ?? [],
        color: createdSchema.color,
        icon: createdSchema.icon,
        change_summary: { added: createdSchema.fields.map(field => field.id) },
        created_by: null,
        created_at: createdSchema.created_at
      });
      await db.workspace.registerPublicIdPrefix(
        createdSchema.key_prefix,
        'schema',
        createdSchema.id,
        createdSchema.created_at
      );
    }

    await seedTemplateCapabilityConfigurations(db);

    for (const config of seedGovernanceCaseConfigs) {
      await db.governanceCaseConfig.upsertCaseConfig(config);
    }
  }
};

export const seedAiConfiguration = async (
  db: DatabaseAdapter,
  aiConfig: AiConfigInputDbUpsert = seedAiConfig
): Promise<void> => {
  for (const workspace of seedWorkspaces) {
    await db.ai.upsertAiConfig(workspace.id, aiConfig);
  }
};

export const seedUsersAndRoles = async (
  db: DatabaseAdapter,
  options: UsersAndRolesSeedOptions
): Promise<void> => {
  const passwordHash = await hashPassword(options.password);
  const createdAt = options.createdAt ?? new Date();
  const workspaces = options.workspaces ?? seedWorkspaces;
  const teamAssignments = options.teamAssignments ?? [];
  const globalRoleAssignments = options.globalRoleAssignments ?? [];
  const workspaceMembers = options.workspaceMembers ?? [];

  for (const user of options.users) {
    await db.auth.createUser({
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      display_name: user.display_name,
      auth_provider: 'local',
      password_hash: passwordHash,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: user.color,
      created_at: createdAt,
      updated_at: createdAt,
      last_login_at: null
    } satisfies UserDbCreate);
  }

  for (const workspace of workspaces) {
    await db.workspace.replaceTeamAssignments(
      workspace.id,
      teamAssignments.filter(assignment => assignment.workspace === workspace.id)
    );
  }

  const rolesByUser = new Map<string, GlobalRoleAssignmentDbResult['role'][]>();
  for (const assignment of globalRoleAssignments) {
    const roles = rolesByUser.get(assignment.user_id) ?? [];
    roles.push(assignment.role);
    rolesByUser.set(assignment.user_id, roles);
  }

  for (const user of options.users) {
    await db.auth.replaceGlobalRoleAssignments(user.id, rolesByUser.get(user.id) ?? [], createdAt);
  }

  for (const member of workspaceMembers) {
    await db.workspace.setWorkspaceMemberRole(
      member.workspace,
      member.user_id,
      member.role,
      member.created_at
    );
  }
};

export const seedBootstrapUsers = async (db: DatabaseAdapter): Promise<void> => {
  await seedUsersAndRoles(db, {
    users: seedLocalUsers,
    password: seededTestPassword,
    teamAssignments: seedTeamAssignments,
    globalRoleAssignments: seedGlobalRoleAssignments,
    workspaceMembers: seedWorkspaceMembers
  });
};

export const seedCatalogEntities = async (
  db: DatabaseAdapter,
  entities: readonly Entity[] = seedEntities
): Promise<void> => {
  for (const entity of entities) {
    await db.catalog.createEntity(entity);
  }
};

export const seedPublicIdCounters = async (
  db: DatabaseAdapter,
  records: readonly SeedPublicIdRecord[],
  syncTimestamp: Date = new Date()
): Promise<void> => {
  const maxByPrefix = new Map<string, number>();
  for (const record of records) {
    if (!record.public_id) continue;
    const parts = record.public_id.split('-');
    const prefix = parts.slice(0, -1).join('-');
    const sequence = parseInt(parts.at(-1) ?? '0', 10);
    if (prefix && !Number.isNaN(sequence)) {
      maxByPrefix.set(prefix, Math.max(maxByPrefix.get(prefix) ?? 0, sequence));
    }
  }

  for (const [prefix, max] of maxByPrefix) {
    await db.workspace.setPublicIdNextNumber(prefix, max + 1, syncTimestamp);
  }
};

export const seedCatalogViews = async (
  db: DatabaseAdapter,
  views: readonly SavedViewDbResult[] = seedSavedViews
): Promise<void> => {
  for (const view of views) {
    await db.view.createSavedView(view);
  }
};
