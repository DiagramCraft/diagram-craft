import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAssessmentsMock = vi.fn();
const useProjectAssessmentsMock = vi.fn();
const useMdxContextMock = vi.fn();

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
  useMdxContext: () => useMdxContextMock()
}));

const { AssessmentsWidget } = await import('./AssessmentsWidget');

const assessment = (overrides: Record<string, unknown>) =>
  ({
    id: 'assessment-1',
    name: 'Assessment',
    status: 'open',
    due_at: null,
    assessment_type_id: null,
    project_id: 'project-1',
    ...overrides
  }) as never;

describe('AssessmentsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useMdxContextMock.mockReturnValue({ dashboardSurface: 'workspace' });
    useAssessmentsMock.mockReturnValue({ data: [], isLoading: false });
    useProjectAssessmentsMock.mockReturnValue({ data: [], isLoading: false });
  });

  it('shows all open assessments in active mode, including undated assessments', () => {
    useAssessmentsMock.mockReturnValue({
      data: [
        assessment({ id: 'upcoming', name: 'Upcoming', due_at: '2999-01-01T00:00:00.000Z' }),
        assessment({ id: 'undated', name: 'Undated', due_at: null }),
        assessment({ id: 'overdue', name: 'Overdue', due_at: '2020-01-01T00:00:00.000Z' }),
        assessment({ id: 'closed', name: 'Closed', status: 'closed' })
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'active' }} />);

    expect(html).toContain('Upcoming');
    expect(html).toContain('Undated');
    expect(html).toContain('Overdue');
    expect(html).not.toContain('Closed');
  });

  it('filters upcoming and overdue modes by due date', () => {
    useAssessmentsMock.mockReturnValue({
      data: [
        assessment({ id: 'upcoming', name: 'Upcoming', due_at: '2999-01-01T00:00:00.000Z' }),
        assessment({ id: 'overdue', name: 'Overdue', due_at: '2020-01-01T00:00:00.000Z' }),
        assessment({ id: 'undated', name: 'Undated', due_at: null })
      ],
      isLoading: false
    });

    expect(renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'upcoming' }} />)).toContain(
      'Upcoming'
    );
    expect(renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'upcoming' }} />)).not.toContain(
      'Overdue'
    );
    expect(renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'overdue' }} />)).toContain(
      'Overdue'
    );
    expect(renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'overdue' }} />)).not.toContain(
      'Undated'
    );
  });

  it('includes every status in all mode and filters by assessment type', () => {
    useAssessmentsMock.mockReturnValue({
      data: [
        assessment({ name: 'Risk review', assessment_type_id: 'risk' }),
        assessment({ name: 'Quality review', status: 'closed', assessment_type_id: 'quality' }),
        assessment({ name: 'Other review', status: 'draft', assessment_type_id: 'other' })
      ],
      isLoading: false
    });

    const html = renderToStaticMarkup(
      <AssessmentsWidget config={{ mode: 'all', assessmentTypeId: 'quality' }} />
    );

    expect(html).toContain('Quality review');
    expect(html).not.toContain('Risk review');
    expect(html).not.toContain('Other review');
  });

  it('uses project-scoped assessments on a project dashboard', () => {
    useMdxContextMock.mockReturnValue({ dashboardSurface: 'project', projectId: 'project-1' });
    useProjectAssessmentsMock.mockReturnValue({
      data: [assessment({ name: 'Project review' })],
      isLoading: false
    });

    const html = renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'active' }} />);

    expect(html).toContain('Project review');
    expect(useAssessmentsMock).toHaveBeenCalledWith('workspace-1', false);
  });

  it('shows an empty state when no assessments match', () => {
    const html = renderToStaticMarkup(<AssessmentsWidget config={{ mode: 'overdue' }} />);

    expect(html).toContain('No overdue assessments.');
  });
});
