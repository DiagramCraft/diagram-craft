import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { TbHistory, TbGitBranch, TbX } from 'react-icons/tb';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { formatTimelineDate } from './timelineUtils';
import styles from './TimelineStrip.module.css';
import { Button } from '@diagram-craft/app-components/Button';

export type AsOfMarker = {
  date: string;
  type: 'future_update' | 'saved_version' | 'applied';
  count: number;
};

type MarkerGroup = {
  pos: number;
  markers: AsOfMarker[];
};

type TimelineStripProps = {
  markers: AsOfMarker[];
  selectedDate?: string;
  onSelect: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
  includeProjectSnapshots?: boolean;
  onToggleIncludeProjectSnapshots?: (include: boolean) => void;
};

const markerTypeLabel = (type: AsOfMarker['type']) => {
  if (type === 'future_update') return 'Planned change';
  if (type === 'applied') return 'Change applied';
  return 'Version saved';
};

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

const useTimelineRange = (markers: AsOfMarker[]) => {
  return useMemo(() => {
    const today = new Date();
    const todayMs = today.getTime();
    const yearMs = 365 * 86400000;

    const markerDates = markers
      .map(m => new Date(`${m.date}T00:00:00`).getTime())
      .filter(t => !Number.isNaN(t));

    let startMs: number;
    let endMs: number;
    if (markerDates.length > 0) {
      startMs = Math.min(todayMs - yearMs, ...markerDates);
      endMs = Math.max(todayMs + yearMs / 2, ...markerDates);
    } else {
      startMs = todayMs - 2 * yearMs;
      endMs = todayMs + yearMs;
    }

    return { todayMs, startMs, endMs, rangeMs: endMs - startMs };
  }, [markers]);
};

export const TimelineStrip = ({
  markers,
  selectedDate,
  onSelect,
  onClear,
  onClose,
  includeProjectSnapshots,
  onToggleIncludeProjectSnapshots
}: TimelineStripProps) => {
  const { todayMs, startMs, endMs, rangeMs } = useTimelineRange(markers);
  const todayIso = useMemo(() => toDateOnly(new Date(todayMs)), [todayMs]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragDate, setDragDate] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ group: MarkerGroup; x: number; y: number } | null>(null);

  const dateToPos = useCallback(
    (dateStr: string) => {
      const ms = new Date(`${dateStr}T00:00:00`).getTime();
      if (Number.isNaN(ms) || rangeMs <= 0) return 0;
      return Math.max(0, Math.min(100, ((ms - startMs) / rangeMs) * 100));
    },
    [rangeMs, startMs]
  );
  const posToDate = useCallback(
    (pct: number) => toDateOnly(new Date(startMs + (pct / 100) * rangeMs)),
    [rangeMs, startMs]
  );

  const posFromClientX = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => setDragDate(posToDate(posFromClientX(e.clientX)));
    const onUp = (e: MouseEvent) => {
      const finalDate = posToDate(posFromClientX(e.clientX));
      setDragging(false);
      setDragDate(null);
      onSelect(finalDate);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, onSelect, posFromClientX, posToDate]);

  const handleTrackMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(`.${styles.markerGroup}`)) return;
    setDragDate(posToDate(posFromClientX(e.clientX)));
    setDragging(true);
  };

  const displayDate = dragging ? dragDate : selectedDate;
  const isFuture = !!displayDate && displayDate > todayIso;
  const todayPos = ((todayMs - startMs) / rangeMs) * 100;

  const years = useMemo(() => {
    const startYear = new Date(startMs).getFullYear();
    const endYear = new Date(endMs).getFullYear();
    const ys: Array<{ y: number; pos: number }> = [];
    for (let y = startYear; y <= endYear; y++) {
      ys.push({ y, pos: dateToPos(`${y}-01-01`) });
    }
    return ys;
  }, [startMs, endMs, dateToPos]);

  const groups = useMemo(() => {
    const gs: MarkerGroup[] = [];
    for (const marker of markers) {
      const pos = dateToPos(marker.date);
      const existing = gs.find(g => Math.abs(g.pos - pos) < 1.2);
      if (existing) existing.markers.push(marker);
      else gs.push({ pos, markers: [marker] });
    }
    return gs;
  }, [markers, dateToPos]);

  return (
    <div
      className={`${styles.panel} ${displayDate ? (isFuture ? styles.panelFuture : styles.panelPast) : ''}`}
    >
      <div className={styles.panelArrow}></div>
      <div className={styles.panelHead}>
        <div className={styles.legend}>
          <span className={`${styles.leg} ${styles.legSv}`}>Version saved</span>
          <span className={`${styles.leg} ${styles.legAp}`}>Change applied</span>
          <span className={`${styles.leg} ${styles.legFu}`}>Planned change</span>
        </div>

        <div className={styles.panelHeadR}>
          {onToggleIncludeProjectSnapshots && (
            <label className={styles.toggleRow}>
              <Checkbox
                value={includeProjectSnapshots ?? true}
                onChange={v => onToggleIncludeProjectSnapshots(v ?? true)}
              />
              <span>Include project changes</span>
            </label>
          )}
          {displayDate && (
            <span
              className={`${styles.modeChip} ${isFuture ? styles.modeChipFuture : styles.modeChipPast}`}
            >
              {isFuture ? <TbGitBranch size={10} /> : <TbHistory size={10} />}
              {isFuture ? 'Projection' : 'Snapshot'} · {displayDate}
            </span>
          )}
          <input
            type="date"
            className={styles.dateInput}
            value={displayDate ?? ''}
            min={toDateOnly(new Date(startMs))}
            max={toDateOnly(new Date(endMs))}
            title="Jump to date"
            onChange={e => (e.target.value ? onSelect(e.target.value) : onClear())}
          />
          {selectedDate ? (
            <Button size="xs" onClick={onClear}>
              &nbsp;Exit snapshot&nbsp;
            </Button>
          ) : null}
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            title="Close timeline"
          >
            <TbX size={11} />
          </button>
        </div>
      </div>

      <div
        className={`${styles.trackWrap} ${dragging ? styles.isDragging : ''}`}
        ref={trackRef}
        onMouseDown={handleTrackMouseDown}
      >
        <div className={`${styles.rgn} ${styles.rgnPast}`} style={{ width: `${todayPos}%` }} />
        <div
          className={`${styles.rgn} ${styles.rgnFuture}`}
          style={{ left: `${todayPos}%`, width: `${100 - todayPos}%` }}
        />
        <div className={styles.line} />

        {years.map(({ y, pos }) => (
          <div key={y} className={styles.year} style={{ left: `${pos}%` }}>
            <div className={styles.yearTick} />
            <div className={styles.yearLbl}>{y}</div>
          </div>
        ))}

        {groups.map((group, gi) => (
          <div
            key={gi}
            className={styles.markerGroup}
            style={{ left: `${group.pos}%` }}
            onMouseEnter={e => setTooltip({ group, x: e.clientX, y: e.clientY })}
            onMouseMove={e => setTooltip(t => (t ? { ...t, x: e.clientX, y: e.clientY } : null))}
            onMouseLeave={() => setTooltip(null)}
            onClick={e => {
              e.stopPropagation();
              onSelect(group.markers[0]!.date);
            }}
          >
            {group.markers.slice(0, 3).map((m, mi) => (
              <div key={mi} className={`${styles.dot} ${styles[`dot-${m.type}`]}`} />
            ))}
            {group.markers.length > 3 && (
              <div className={styles.dotExtra}>+{group.markers.length - 3}</div>
            )}
          </div>
        ))}

        <div className={styles.now} style={{ left: `${todayPos}%` }}>
          <div className={styles.nowLine} />
          <div className={styles.nowLbl}>Today</div>
        </div>

        {displayDate && (
          <div
            className={`${styles.scrubber} ${isFuture ? styles.scrubberFuture : ''}`}
            style={{ left: `${dateToPos(displayDate)}%` }}
          >
            <div className={styles.scrubberLine} />
            <div className={styles.scrubberPip} />
          </div>
        )}
      </div>

      {tooltip &&
        createPortal(
          <div className={styles.tooltip} style={{ left: tooltip.x + 14, top: tooltip.y - 80 }}>
            <div className={styles.tipDate}>
              {formatTimelineDate(tooltip.group.markers[0]!.date)}
            </div>
            {tooltip.group.markers.map((m, i) => (
              <div key={i} className={styles.tipRow}>
                <span className={`${styles.tipDot} ${styles[`tipDot-${m.type}`]}`} />
                <span className={styles.tipLbl}>
                  {markerTypeLabel(m.type)}
                  {m.count > 1 ? ` ×${m.count}` : ''}
                </span>
              </div>
            ))}
            <div className={styles.tipHint}>Click to jump to this date</div>
          </div>,
          document.body
        )}
    </div>
  );
};
