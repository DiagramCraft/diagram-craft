import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { AssessmentSummaryTab } from './AssessmentSummaryTab';

const baseAssessment: Assessment = {
  id: 'assessment-1',
  workspace: 'ws-1',
  project_id: 'project-1',
  name: 'Data quality check',
  description: '',
  status: 'open',
  mode: 'fields',
  scope: [],
  scope_conditions: [],
  fields: [],
  assigned_team_ids: [],
  due_at: null,
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  next_occurrence_at: null,
  response_count: 0,
  completed_entity_count: 0,
  team_acknowledge_status: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z'
};

describe('AssessmentSummaryTab', () => {
  it('does not render a team acknowledgement card when no teams are assigned', () => {
    const markup = renderToStaticMarkup(
      <AssessmentSummaryTab assessment={baseAssessment} responses={[]} entityCount={0} enums={[]} />
    );

    expect(markup).not.toContain('Team acknowledgement');
  });

  it('renders per-team acknowledge status when teams are assigned', () => {
    const assessment: Assessment = {
      ...baseAssessment,
      assigned_team_ids: ['team-a', 'team-b'],
      team_acknowledge_status: [
        { team_id: 'team-a', team_name: 'Team A', status: 'open', resolved_at: null },
        {
          team_id: 'team-b',
          team_name: 'Team B',
          status: 'completed',
          resolved_at: '2026-01-02T00:00:00.000Z'
        }
      ]
    };

    const markup = renderToStaticMarkup(
      <AssessmentSummaryTab assessment={assessment} responses={[]} entityCount={0} enums={[]} />
    );

    expect(markup).toContain('Team acknowledgement');
    expect(markup).toContain('Team A');
    expect(markup).toContain('Pending');
    expect(markup).toContain('Team B');
    expect(markup).toContain('Acknowledged');
  });
});
