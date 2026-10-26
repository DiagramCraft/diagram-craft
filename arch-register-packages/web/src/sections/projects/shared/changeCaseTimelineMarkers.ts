import type { Milestone } from '@arch-register/api-types/milestoneContract';
import type { AsOfMarker } from '../../../components/timeline/TimelineStrip';
import {
  getSnapshotEffectiveDate,
  type ChangeCaseMemberEntry
} from '../../entities/components/snapshotDisplay';

/**
 * Counts planned and applied change-case members per effective date, for the "browse as of date"
 * strip. Undated changes have no position on the strip and are skipped.
 */
export const buildTimelineMarkers = (
  entries: ChangeCaseMemberEntry[],
  milestonesById: Map<string, Milestone>
): AsOfMarker[] => {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const effectiveDate = getSnapshotEffectiveDate(entry.changeCase, milestonesById);
    if (!effectiveDate) continue;
    const status = entry.changeCase.status === 'applied' ? 'applied' : 'future_update';
    const key = `${effectiveDate}|${status}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, count]) => {
    const [date, type] = key.split('|') as [string, 'future_update' | 'applied'];
    return { date, type, count };
  });
};
