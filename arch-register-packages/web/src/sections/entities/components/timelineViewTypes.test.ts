import { describe, expect, it } from 'vitest';
import { getTimelineConfigDefaults } from './timelineViewTypes';

describe('timeline view configuration defaults', () => {
  it('maps the first two date fields to the start and end axes', () => {
    expect(
      getTimelineConfigDefaults([
        { id: 'start', label: 'Start' },
        { id: 'end', label: 'End' }
      ])
    ).toEqual({
      startFieldId: 'start',
      endFieldId: 'end',
      groupBy: 'snapshot',
      zoom: 'quarter',
      showProjectLanes: true,
      showMilestones: true,
      showAutosaves: true,
      showHorizonBands: true
    });
  });

  it('uses the only available date field for both axes', () => {
    const defaults = getTimelineConfigDefaults([{ id: 'date', label: 'Date' }]);
    expect(defaults.startFieldId).toBe('date');
    expect(defaults.endFieldId).toBe('date');
  });
});
