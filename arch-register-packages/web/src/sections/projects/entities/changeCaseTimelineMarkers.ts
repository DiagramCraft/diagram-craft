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
  const markers = new Map<string, AsOfMarker>();
  for (const entry of entries) {
    const date = getSnapshotEffectiveDate(entry.changeCase, milestonesById);
    if (!date) continue;
    const type = entry.changeCase.status === 'applied' ? 'applied' : 'future_update';
    const key = `${date}|${type}`;
    const marker = markers.get(key);
    if (marker) marker.count += 1;
    else markers.set(key, { date, type, count: 1 });
  }
  return [...markers.values()];
};
