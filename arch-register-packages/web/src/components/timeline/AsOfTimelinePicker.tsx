import { useRef } from 'react';
import { TbCalendarEvent } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { formatTimelineDate } from './timelineUtils';
import styles from './AsOfTimelinePicker.module.css';

export type AsOfMarker = {
  date: string;
  type: 'future_update' | 'saved_version';
  count: number;
};

type AsOfTimelinePickerProps = {
  markers: AsOfMarker[];
  onSelect: (date: string) => void;
  includeProjectSnapshots?: boolean;
  onToggleIncludeProjectSnapshots?: (include: boolean) => void;
};

const markerTypeLabel = (type: AsOfMarker['type']) =>
  type === 'future_update' ? 'Planned change' : 'Saved version';

export const AsOfTimelinePicker = ({
  markers,
  onSelect,
  includeProjectSnapshots,
  onToggleIncludeProjectSnapshots
}: AsOfTimelinePickerProps) => {
  const popoverRef = useRef<PopoverActions | null>(null);
  const sortedMarkers = [...markers].sort((a, b) => a.date.localeCompare(b.date));

  const handleSelect = (date: string) => {
    onSelect(date);
    popoverRef.current?.close();
  };

  return (
    <Popover.Root actionsRef={popoverRef}>
      <Popover.Trigger
        element={
          <Button size="sm" variant="secondary" icon={<TbCalendarEvent size={12} />}>
            Browse as of…
          </Button>
        }
      />
      <Popover.Content sideOffset={4} align="start" arrow={false} closeButton={false}>
        <div className={styles.content}>
          <div className={styles.dateRow}>
            <input
              type="date"
              onChange={e => e.target.value && handleSelect(e.target.value)}
              aria-label="Pick a date to browse as of"
            />
          </div>
          {onToggleIncludeProjectSnapshots && (
            <label className={styles.toggleRow}>
              <Checkbox
                value={includeProjectSnapshots ?? true}
                onChange={v => onToggleIncludeProjectSnapshots(v ?? true)}
              />
              <span>Include project changes</span>
            </label>
          )}
          <div className={styles.markersLabel}>Events</div>
          {sortedMarkers.length === 0 ? (
            <div className={styles.empty}>No planned changes or saved versions yet.</div>
          ) : (
            <div className={styles.markerList}>
              {sortedMarkers.map(marker => (
                <button
                  key={`${marker.date}-${marker.type}`}
                  type="button"
                  className={styles.markerRow}
                  onClick={() => handleSelect(marker.date)}
                >
                  <span className={`${styles.markerDot} ${styles[marker.type]}`} />
                  <span className={styles.markerDate}>{formatTimelineDate(marker.date)}</span>
                  <span className={styles.markerType}>
                    {markerTypeLabel(marker.type)}
                    {marker.count > 1 ? ` ×${marker.count}` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
