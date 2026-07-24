import { describe, expect, it } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { buildSystemPrompt } from './systemPromptBuilder';

const now = new Date('2026-06-16T12:00:00.000Z');

describe('buildSystemPrompt', () => {
  it('builds model summaries from visible entities only', async () => {
    const db = {
      catalog: {
        listSchemas: async () => [
          {
            id: 'schema-1',
            workspace: 'ws-1',
            name: 'Application',
            fields: [{ id: 'tech', name: 'Tech', type: 'text' }],
            color: null,
            icon: null,
            default_owner: null,
            key_prefix: 'APP',
            description: '',
            created_at: now,
            updated_at: now
          }
        ],
        listEntitiesPaginated: async (
          _ws: string,
          _filters: unknown,
          { limit, offset }: { limit: number; offset: number }
        ) => {
          const all = [
            {
              id: 'entity-owned',
              workspace: 'ws-1',
              public_id: 'APP-1',
              slug: 'owned-app',
              namespace: 'default',
              name: 'Owned App',
              description: '',
              owner: 'team-1',
              lifecycle: null,
              target_lifecycle: null,
              target_lifecycle_date: null,
              tags: [],
              links: [],
              schema_id: 'schema-1',
              data: {},

              owner_name: null,
              lifecycle_label: null,
              target_lifecycle_label: null,
              schema_name: 'Application',
              created_at: now,
              updated_at: now
            },
            {
              id: 'entity-unowned',
              workspace: 'ws-1',
              public_id: 'APP-2',
              slug: 'unowned-app',
              namespace: 'default',
              name: 'Unowned App',
              description: '',
              owner: null,
              lifecycle: null,
              target_lifecycle: null,
              target_lifecycle_date: null,
              tags: [],
              links: [],
              schema_id: 'schema-1',
              data: {},

              owner_name: null,
              lifecycle_label: null,
              target_lifecycle_label: null,
              schema_name: 'Application',
              created_at: now,
              updated_at: now
            }
          ];
          return all.slice(offset, offset + limit);
        },
        listEntities: async () => [
          {
            id: 'entity-owned',
            workspace: 'ws-1',
            public_id: 'APP-1',
            slug: 'owned-app',
            namespace: 'default',
            name: 'Owned App',
            description: '',
            owner: 'team-1',
            lifecycle: null,
            target_lifecycle: null,
            target_lifecycle_date: null,
            tags: [],
            links: [],
            schema_id: 'schema-1',
            data: {},

            owner_name: null,
            lifecycle_label: null,
            target_lifecycle_label: null,
            schema_name: 'Application',
            created_at: now,
            updated_at: now
          },
          {
            id: 'entity-unowned',
            workspace: 'ws-1',
            public_id: 'APP-2',
            slug: 'unowned-app',
            namespace: 'default',
            name: 'Unowned App',
            description: '',
            owner: null,
            lifecycle: null,
            target_lifecycle: null,
            target_lifecycle_date: null,
            tags: [],
            links: [],
            schema_id: 'schema-1',
            data: {},

            owner_name: null,
            lifecycle_label: null,
            target_lifecycle_label: null,
            schema_name: 'Application',
            created_at: now,
            updated_at: now
          }
        ]
      },
      workspace: {
        listLifecycleStates: async () => [],
        listTeams: async () => []
      }
    } as unknown as DatabaseAdapter;

    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
      schemas: [
        {
          id: 'schema-1',
          workspace: 'ws-1',
          name: 'Application',
          fields: [{ id: 'tech', name: 'Tech', type: 'text' }],
          color: null,
          icon: null,
          default_owner: null,
          created_at: now,
          updated_at: now
        }
      ],
      entities: [
        {
          id: 'entity-owned',
          workspace: 'ws-1',
          slug: 'owned-app',
          namespace: 'default',
          name: 'Owned App',
          description: '',
          owner: 'team-1',
          lifecycle: null,
          tags: [],
          links: [],
          schema_id: 'schema-1',
          data: {},
          created_at: now,
          updated_at: now
        },
        {
          id: 'entity-unowned',
          workspace: 'ws-1',
          slug: 'unowned-app',
          namespace: 'default',
          name: 'Unowned App',
          description: '',
          owner: null,
          lifecycle: null,
          tags: [],
          links: [],
          schema_id: 'schema-1',
          data: {},
          created_at: now,
          updated_at: now
        }
      ],
      grants: []
    });

    const prompt = await buildSystemPrompt(db, 'ws-1', authCtx, null);

    expect(prompt).toContain('Total entities: 1');
    expect(prompt).toContain('### Application (1 entities)');
    expect(prompt).not.toContain('2 entities');
  });
});
