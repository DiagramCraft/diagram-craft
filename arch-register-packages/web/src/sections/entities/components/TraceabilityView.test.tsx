import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { TraceabilityViewConfig } from '@arch-register/api-types/viewContract';

vi.mock('@tanstack/react-query', () => ({
  useQueries: () => []
}));
vi.mock('../../../hooks/useEntities', () => ({
  useEntities: () => ({ data: [], isError: false, isLoading: false }),
  useEntitiesByIds: () => new Map(),
  useEntitiesBySchema: () => []
}));
vi.mock('../../../queries/projects', () => ({ projectEntitiesQuery: () => ({}) }));
vi.mock('../../../components/EntityNavigationLink', () => ({
  EntityNavigationLink: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));

const { TraceabilityView } = await import('./TraceabilityView');

const makeRelation = (
  id: string,
  name: string,
  inSchemaIds: string[] | 'any',
  outSchemaIds: string[] | 'any'
) =>
  ({
    id,
    workspace: 'workspace',
    name,
    category: null,
    description: '',
    in: { schemaIds: inSchemaIds },
    out: { schemaIds: outSchemaIds },
    fields: [],
    groups: [],
    color: null,
    icon: null,
    relation_count: 0,
    version: 1,
    created_at: '',
    updated_at: ''
  }) as RelationSchema;

const config: TraceabilityViewConfig = {
  paths: [
    {
      id: 'strategy',
      label: 'Strategy',
      path: [
        {
          kind: 'unboundTypedRelation',
          relationSchemaId: 'objective-supports-capability',
          direction: 'in'
        }
      ],
      targetSchemaIds: 'any'
    }
  ],
  deliverySources: ['projects'],
  showOrphanEntities: true,
  showOrphanProjects: true
};

describe('TraceabilityView', () => {
  it('renders the arrow selector before a direction-filtered relation selector', () => {
    const markup = renderToStaticMarkup(
      <TraceabilityView
        rows={[]}
        rootSchemaIds={['objective']}
        schemas={[
          { id: 'objective', name: 'Objective' } as never,
          { id: 'capability', name: 'Business Capability' } as never
        ]}
        relationSchemas={[
          makeRelation(
            'objective-supports-capability',
            'Supports capability',
            ['objective'],
            ['capability']
          ),
          makeRelation('capability-supports-entity', 'Supports entity', ['capability'], 'any'),
          makeRelation('objective-affects-entity', 'Affects entity', ['objective'], 'any')
        ]}
        projects={[{ id: 'project-1', public_id: 'project-1', name: 'Project 1' } as never]}
        workspaceId="workspace"
        config={config}
        onConfigChange={() => {}}
        onEntityClick={() => {}}
        hideToolbar={false}
      />
    );

    const directionIndex = markup.indexOf('aria-label="Direction for strategy hop 1"');
    const relationIndex = markup.indexOf('aria-labelledby="trace-relation-label-strategy-0"');

    expect(directionIndex).toBeGreaterThanOrEqual(0);
    expect(relationIndex).toBeGreaterThan(directionIndex);
    expect(markup).toContain('>Supports capability</option>');
    expect(markup).not.toContain('>Supports entity</option>');
    expect(markup).toContain('>Entity: 0/0 covered</span>');
    expect(markup).not.toContain('>Architecture: 0/0 covered</span>');
    expect(markup).toContain('1 projects without traceability coverage');
    expect(markup).not.toContain('>Projects without traceability coverage</h4>');
    expect(markup).not.toContain('Projects without strategic alignment');
    expect(markup).not.toContain('milestones');
    expect(markup).not.toContain('Planned changes');
    expect(markup).not.toContain('assessments');
  });
});
