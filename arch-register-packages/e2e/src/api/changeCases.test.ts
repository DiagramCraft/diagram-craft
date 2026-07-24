import { createApiTest, expect } from '../helpers/fixtures';
import { seedCatalogEntities, seedIds } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const systemId = '00000000-0000-0000-0002-000000000001';

const componentState = (name: string, data: Record<string, unknown>) => ({
  schema_id: componentSchemaId,
  name,
  slug: name.toLowerCase().replaceAll(' ', '-'),
  namespace: 'default',
  description: '',
  owner: seedIds.teams.design,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  data
});

test.describe('planned new project entities', () => {
  test('creates project-scoped drafts, resolves draft relations, and promotes them on apply', async ({
    orpc
  }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Planned Entities Project', owner: seedIds.teams.design, status: 'active' }
    });

    const changeCase = await orpc.changeCases.create({
      params: { workspace: 'default', id: project.id },
      body: {
        name: 'Introduce planned components',
        members: [
          {
            draftId: 'draft-component-a',
            proposedState: componentState('Planned Component A', { system: [systemId] })
          },
          {
            draftId: 'draft-component-b',
            proposedState: componentState('Planned Component B', {
              system: [systemId],
              depends_on: ['draft-component-a']
            })
          }
        ],
        newEntities: [
          {
            draftId: 'draft-component-a',
            state: componentState('Planned Component A', { system: [systemId] })
          },
          {
            draftId: 'draft-component-b',
            state: componentState('Planned Component B', {
              system: [systemId],
              depends_on: ['draft-component-a']
            })
          }
        ]
      }
    });

    expect(changeCase.members).toHaveLength(2);
    const first = changeCase.members.find(
      member => member.proposed_state.name === 'Planned Component A'
    );
    const second = changeCase.members.find(
      member => member.proposed_state.name === 'Planned Component B'
    );
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.proposed_state.project_id).toBeNull();
    expect(second?.proposed_state.project_id).toBeNull();
    expect(second?.proposed_state.data).toMatchObject({ depends_on: [first?.entity_id] });

    const savedCase = await orpc.changeCases.saveDraft({
      params: { workspace: 'default', id: project.id, caseId: changeCase.id },
      body: {
        name: 'Introduce planned components (updated)',
        members: changeCase.members.map(member => ({
          entityId: member.entity_id,
          proposedState: member.proposed_state
        })),
        newEntities: []
      }
    });
    expect(savedCase.name).toBe('Introduce planned components (updated)');

    const plannedEntity = await orpc.entities.get({
      params: { workspace: 'default', id: first!.entity_id }
    });
    expect(plannedEntity._projectId).toBe(project.id);

    const linkedEntities = await orpc.projects.listEntities({
      params: { workspace: 'default', id: project.id }
    });
    expect(linkedEntities.map(entity => entity.entity_id)).toEqual(
      expect.arrayContaining(changeCase.members.map(member => member.entity_id))
    );

    const applied = await orpc.changeCases.apply({
      params: { workspace: 'default', id: project.id, caseId: savedCase.id },
      body: {
        resolutions: savedCase.members.map(member => ({
          memberId: member.id,
          resolvedEntityData: member.proposed_state
        }))
      }
    });
    expect(applied.status).toBe('applied');

    const promotedEntity = await orpc.entities.get({
      params: { workspace: 'default', id: first!.entity_id }
    });
    expect(promotedEntity._projectId).toBeNull();
  });
});
