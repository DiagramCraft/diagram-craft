import { describe, expect, it } from 'vitest';
import { seedAssessmentTypes, seedAssessments, seedWorkspaceDashboards } from './seedData';

describe('dashboard assessment seed data', () => {
  it('seeds the standard assessment types in display order', () => {
    expect(seedAssessmentTypes.map(type => [type.name, type.sort_order])).toEqual([
      ['Risk & compliance', 0],
      ['Quality Review', 1],
      ['Project', 2]
    ]);
  });

  it('assigns the seeded review and dashboard widget to Risk & compliance', () => {
    const riskComplianceType = seedAssessmentTypes.find(type => type.name === 'Risk & compliance');
    const assessment = seedAssessments.find(
      item => item.name === 'Quarterly risk and control review'
    );
    const widget = seedWorkspaceDashboards[0]?.layout.find(
      item => item.id === 'overdue-risk-control-reviews'
    );

    expect(assessment?.assessment_type_id).toBe(riskComplianceType?.id);
    expect(widget).toMatchObject({
      type: 'Assessments',
      config: {
        mode: 'overdue',
        assessmentTypeId: riskComplianceType?.id
      }
    });
  });
});
