import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { EntityDrawerProviderContext } from './EntityDrawerProviderRegistry';
import { entityAssessmentsDrawerProviderDefinitions } from './EntityAssessmentsProvider';

const assessments = {
  rows: [
    {
      assessment: { id: 'assessment-1' },
      entity: { _uid: 'service-1' },
      kind: 'Periodic review',
      status: 'complete' as const,
      due: null
    }
  ],
  summaries: [],
  isLoading: false
};

vi.mock('./useEntityAssessmentRows', () => ({
  useEntityAssessmentRows: () => assessments
}));

const context = {
  workspaceId: 'workspace-1',
  entity: { _uid: 'service-1', _name: 'Payments' },
  schema: { id: 'service', name: 'Service', fields: [] },
  schemas: [],
  relationSchemas: [],
  relations: { outgoing: [], incoming: [] },
  typedRelations: { outgoing: [], incoming: [] },
  typedRelationsStatus: { isLoading: false, isError: false },
  openEntity: vi.fn()
} as unknown as EntityDrawerProviderContext;

describe('Entity assessments drawer provider', () => {
  it('renders assessments for an entity without Data Stewardship fields', () => {
    const definition = entityAssessmentsDrawerProviderDefinitions[0]!;
    const markup = renderToStaticMarkup(
      <definition.Component
        context={context}
        item={{ kind: 'slot', slotId: 'entity.assessments' }}
      />
    );

    expect(markup).toContain('Periodic review');
    expect(markup).toContain('Complete');
  });
});
