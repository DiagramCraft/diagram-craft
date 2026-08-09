import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useEntityCountMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../../hooks/useEntities', () => ({
  useEntityCount: (...args: unknown[]) => useEntityCountMock(...args)
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaceSlug: 'workspace-1',
    schemas: [{ id: 'compliance_requirement', name: 'Compliance requirement' }]
  })
}));

vi.mock('../../markdown/MdxContext', () => ({
  useMdxContext: () => ({ renderMode: 'wiki' })
}));

const { AggregateStatWidget } = await import('./AggregateStatWidget');

describe('AggregateStatWidget', () => {
  it('renders the percentage of entities matching the numerator condition', () => {
    useEntityCountMock.mockImplementation(
      (_workspaceId: string, options: { conditions?: unknown }) =>
        options.conditions
          ? { data: { total: 3 }, isLoading: false }
          : { data: { total: 10 }, isLoading: false }
    );

    const html = renderToStaticMarkup(
      <AggregateStatWidget
        config={{
          schema: 'compliance_requirement',
          numeratorCondition: { fieldId: 'status', op: 'equals', value: 'met' },
          label: 'Compliance coverage'
        }}
      />
    );

    expect(html).toContain('30%');
    expect(html).toContain('Compliance coverage');
  });

  it('shows an unconfigured message when the schema or condition is missing', () => {
    const html = renderToStaticMarkup(<AggregateStatWidget config={{ schema: '' }} />);

    expect(html).toContain('not fully configured');
  });

  it('treats an empty denominator as 0%', () => {
    useEntityCountMock.mockReturnValue({ data: { total: 0 }, isLoading: false });

    const html = renderToStaticMarkup(
      <AggregateStatWidget
        config={{
          schema: 'compliance_requirement',
          numeratorCondition: { fieldId: 'status', op: 'equals', value: 'met' }
        }}
      />
    );

    expect(html).toContain('0%');
  });
});
