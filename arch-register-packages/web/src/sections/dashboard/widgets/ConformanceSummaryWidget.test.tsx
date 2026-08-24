import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ConformanceSummary } from '@arch-register/api-types/conformanceContract';

const useConformanceSummaryMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../../hooks/useConformance', () => ({
  useConformanceSummary: (...args: unknown[]) => useConformanceSummaryMock(...args)
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({
    workspaceSlug: 'workspace-1',
    permissions: { canViewSchemas: true }
  })
}));

const { ConformanceSummaryWidget } = await import('./ConformanceSummaryWidget');

const summary: ConformanceSummary = {
  active: 3,
  acknowledged: 1,
  warnings: 2,
  errors: 1,
  exempt: 0,
  resolvedRecently: 0,
  lastRunAt: '2026-08-24T12:00:00.000Z',
  byCheck: [{ id: 'check-owner', name: 'Entities need owners', count: 2 }],
  bySchema: [{ id: 'schema-service', name: 'Service', count: 3 }]
};

describe('ConformanceSummaryWidget', () => {
  it('renders active counts grouped by check and schema', () => {
    useConformanceSummaryMock.mockReturnValue({ data: summary, isLoading: false });

    const markup = renderToStaticMarkup(<ConformanceSummaryWidget config={{}} />);

    expect(markup).toContain('By check');
    expect(markup).toContain('Entities need owners');
    expect(markup).toContain('By schema');
    expect(markup).toContain('Service');
  });
});
