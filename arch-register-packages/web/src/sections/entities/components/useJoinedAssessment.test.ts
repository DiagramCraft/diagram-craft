import { describe, expect, it } from 'vitest';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import {
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
