import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const useAssessmentsMock = vi.fn();
const useProjectAssessmentsMock = vi.fn();

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => vi.fn()
}));

vi.mock('../../../hooks/useAssessments', () => ({
  useAssessments: (...args: unknown[]) => useAssessmentsMock(...args),
  useProjectAssessments: (...args: unknown[]) => useProjectAssessmentsMock(...args)
}));

vi.mock('../../../layouts/WorkspaceContext', () => ({
  useWorkspaceContext: () => ({ workspaceSlug: 'workspace-1' })
}));

vi.mock('../../markdown/MdxContext', () => ({
  useMdxContext: () => ({ dashboardSurface: 'workspace' })
}));

const { OverdueReviewsWidget } = await import('./OverdueReviewsWidget');

describe('OverdueReviewsWidget', () => {
  it('lists only open, past-due assessments, soonest overdue first', () => {
    useProjectAssessmentsMock.mockReturnValue({ data: [], isLoading: false });
    useAssessmentsMock.mockReturnValue({
      data: [
        {
          id: 'a1',
          name: 'Overdue A',
          status: 'open',
          due_at: '2020-01-01T00:00:00.000Z',
          scope: ['risk'],
          project_id: 'p1'
        },
        {
          id: 'a2',
          name: 'Not due yet',
          status: 'open',
          due_at: '2999-01-01T00:00:00.000Z',
          scope: ['risk'],
          project_id: 'p1'
        },
        {
          id: 'a3',
          name: 'Overdue B',
          status: 'open',
          due_at: '2019-01-01T00:00:00.000Z',
          scope: ['risk'],
          project_id: 'p1'
        },
        {
          id: 'a4',
          name: 'Closed overdue',
          status: 'closed',
          due_at: '2018-01-01T00:00:00.000Z',
          scope: ['risk'],
          project_id: 'p1'
        }
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(<OverdueReviewsWidget config={{}} />);

    expect(html).toContain('Overdue A');
    expect(html).toContain('Overdue B');
    expect(html).not.toContain('Not due yet');
    expect(html).not.toContain('Closed overdue');
    expect(html.indexOf('Overdue B')).toBeLessThan(html.indexOf('Overdue A'));
  });

  it('filters by assessment type when configured', () => {
    useProjectAssessmentsMock.mockReturnValue({ data: [], isLoading: false });
    useAssessmentsMock.mockReturnValue({
      data: [
        {
          id: 'a1',
          name: 'Risk review',
          status: 'open',
          due_at: '2020-01-01T00:00:00.000Z',
          scope: ['risk'],
          assessment_type_id: 'risk-compliance',
          project_id: 'p1'
        },
        {
          id: 'a2',
          name: 'Service review',
          status: 'open',
          due_at: '2020-01-01T00:00:00.000Z',
          scope: ['service'],
          assessment_type_id: 'service-review',
          project_id: 'p1'
        }
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(
      <OverdueReviewsWidget config={{ assessmentTypeId: 'risk-compliance' }} />
    );

    expect(html).toContain('Risk review');
    expect(html).not.toContain('Service review');
  });

  it('shows an empty state when there are no overdue reviews', () => {
    useProjectAssessmentsMock.mockReturnValue({ data: [], isLoading: false });
    useAssessmentsMock.mockReturnValue({ data: [], isLoading: false });

    const html = renderToStaticMarkup(<OverdueReviewsWidget config={{}} />);

    expect(html).toContain('No overdue reviews.');
  });
});
