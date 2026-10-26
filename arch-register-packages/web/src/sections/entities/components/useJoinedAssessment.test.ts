import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import {
  buildAssessmentJoinOptions,
  getAssessmentProjectIds,
  isJoinableAssessment,
  resolveJoinAssessmentId,
  type AssessmentJoinOption
} from './useJoinedAssessment';

const option = (assessmentId: string): AssessmentJoinOption => ({
  assessment: { id: assessmentId } as Assessment,
  projectId: 'project-1',
  projectName: 'Project 1'
});

describe('useJoinedAssessment helpers', () => {
  it('uses every project in workspace context and only the active project in project context', () => {
    const projects = [{ id: 'project-1' }, { id: 'project-2' }];

    expect(getAssessmentProjectIds(projects)).toEqual(['project-1', 'project-2']);
    expect(getAssessmentProjectIds(projects, 'project-2')).toEqual(['project-2']);
  });

  it('keeps workspace selections but rejects selections outside the active project', () => {
    const options = [option('assessment-1')];

    expect(resolveJoinAssessmentId('assessment-2', options)).toBe('assessment-2');
    expect(resolveJoinAssessmentId('assessment-1', options, 'project-1')).toBe('assessment-1');
    expect(resolveJoinAssessmentId('assessment-2', options, 'project-1')).toBeNull();
  });

  it.each([
    ['open', true],
    ['closed', true],
    ['draft', false],
    ['archived', false]
  ] as const)('allows only open and closed assessments (%s)', (status, expected) => {
    expect(isJoinableAssessment({ status })).toBe(expected);
  });
});

describe('buildAssessmentJoinOptions', () => {
  const projects = [
    { id: 'project-1', name: 'Project 1' },
    { id: 'project-2', name: 'Project 2' }
  ];
  const assessment = (id: string, project_id: string, status: Assessment['status']) =>
    ({ id, project_id, status }) as Assessment;
  const assessments = [
    assessment('open-1', 'project-1', 'open'),
    assessment('closed-1', 'project-1', 'closed'),
    assessment('draft-1', 'project-1', 'draft'),
    assessment('open-2', 'project-2', 'open')
  ];

  it('lists open and closed assessments from every project in workspace context', () => {
    const result = buildAssessmentJoinOptions(assessments, projects);
    expect(result.map(o => o.assessment.id)).toEqual(['open-1', 'closed-1', 'open-2']);
    expect(result.map(o => o.projectName)).toEqual(['Project 1', 'Project 1', 'Project 2']);
  });

  it('narrows to the project given by its internal id in project context', () => {
    // Regression: the project browser passes the internal id, which used to be compared against
    // the public id, leaving the Assessment picker permanently empty and disabled.
    expect(
      buildAssessmentJoinOptions(assessments, projects, 'project-1').map(o => o.assessment.id)
    ).toEqual(['open-1', 'closed-1']);
  });

  it('is empty for a project without joinable assessments', () => {
    expect(buildAssessmentJoinOptions(assessments, projects, 'project-3')).toEqual([]);
  });
});
