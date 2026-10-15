import { useMemo } from 'react';
import {
  SnapshotTimelineShell,
  useSnapshotTimeline
} from '../../../components/timeline/SnapshotTimeline';
import {
  dateToTimelinePx,
  type TimelineColumnWidths
} from '../../../components/timeline/timelineUtils';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { formatDate } from '../../../utils/dateFormat';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { daysFromToday } from '../date-calendar/dateCalendarLogic';
import { buildPositionedRanges } from './dateRangeTimelineLogic';
import { formatMeasured, measuredValue } from '../../shared/data/fieldAggregation';
import { countdownTone } from '../../data-views/upcoming-by-date/upcomingByDateLogic';
import { useRecordSublabels } from '../../shared/data/useRecordSublabels';
import rowStyles from '../../shared/dashboard/WidgetRowList.module.css';
import styles from './DateRangeTimeline.module.css';
import { DateRangeTimelineWidgetConfig } from './types';

const LABEL_WIDTH = 220;

const COLUMN_WIDTHS: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };

// Minimum on-screen bar width (px) so a very short range is still clickable/visible.
const MIN_BAR_WIDTH = 6;

const TONE_COLOR = {
  normal: 'var(--cmp-fg-success, #22c55e)',
  warn: 'var(--cmp-fg-warning, #eab308)',
  crit: 'var(--cmp-fg-danger, #ef4444)'
} as const;

type Props = { config: DateRangeTimelineWidgetConfig };

/** Records as a Gantt chart: a bar from a start date to an end date, an optional marker and a today line. */
export const DateRangeTimelineWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const { data, isLoading } = useWidgetRecords(workspaceSlug, config);
  const today = useMemo(() => new Date(), []);

  const records = useMemo(() => data?.entities ?? [], [data]);
  const { positioned, excludedCount } = useMemo(
    () =>
      buildPositionedRanges(records, {
        startFieldId: config.startFieldId,
        endFieldId: config.endFieldId,
        markerOffsetFieldId: config.markerOffsetFieldId,
        markerWhenFieldId: config.markerWhenFieldId
      }),
    [records, config]
  );
  const sublabelOf = useRecordSublabels(
    positioned.map(({ record }) => record),
    config.sublabelFieldId
  );

  const dates = useMemo(() => positioned.flatMap(({ start, end }) => [start, end]), [positioned]);
  const timeline = useSnapshotTimeline({ dates, zoom: 'year', columnWidths: COLUMN_WIDTHS, today });

  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }
  if (positioned.length === 0) {
    return (
      <div className={`${styles.empty} dim`}>
        {excludedCount > 0
          ? 'No records with both a start and end date to plot.'
          : 'Nothing to plot.'}
      </div>
    );
  }

  const toPx = (date: Date) =>
    dateToTimelinePx(date, timeline.rangeStart, timeline.rangeEnd, timeline.totalWidth);

  return (
    <div className={styles.body}>
      <SnapshotTimelineShell
        context={timeline}
        scrollClassName={styles.scroll}
        innerClassName={styles.inner}
        labelWidth={LABEL_WIDTH}
        classes={{
          head: styles.head,
          corner: styles.corner,
          cornerLabel: styles.cornerLabel,
          columns: styles.cols,
          column: styles.col,
          currentColumn: styles.colNow,
          today: styles.today,
          todayPip: styles.todayPip,
          milestoneLine: undefined,
          milestoneLabel: undefined
        }}
        cornerLabel={`${positioned.length} record${positioned.length === 1 ? '' : 's'}`}
        showMilestones={false}
      >
        {positioned.map(({ record, start, end, markerDate, markerDays }) => {
          const startPx = toPx(start);
          const width = Math.max(MIN_BAR_WIDTH, toPx(end) - startPx);
          const tone =
            TONE_COLOR[
              countdownTone(
                daysFromToday(end, today),
                config.warnWithinDays ?? 30,
                config.critWithinDays ?? -1
              )
            ];
          const sublabel = sublabelOf(record);
          const value = config.valueFieldId
            ? measuredValue(record[config.valueFieldId])
            : undefined;
          const name = String(record._name);
          return (
            <div key={String(record._uid)} className={styles.row}>
              <div className={styles.label}>
                <span className={styles.name}>{name}</span>
                {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
              </div>
              <div className={styles.track} style={{ width: timeline.totalWidth }}>
                <button
                  type="button"
                  className={styles.bar}
                  style={{ left: startPx, width, background: tone }}
                  onClick={() => openEntityDrawer(String(record._publicId))}
                  title={`${name} · ${formatDate(start, '—', dateTimeFormatPreference)} → ${formatDate(end, '—', dateTimeFormatPreference)}`}
                >
                  <span className={styles.barLabel}>
                    {value ? formatMeasured(value.amount, value.currency) : null}
                  </span>
                </button>
                {markerDate && (
                  <span
                    className={styles.notice}
                    style={{ left: toPx(markerDate) }}
                    title={`${markerDays} days before end`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </SnapshotTimelineShell>

      {excludedCount > 0 && (
        <div className={`${styles.caption} dim`}>
          {excludedCount} record{excludedCount === 1 ? '' : 's'} missing a start or end date — not
          shown here.
        </div>
      )}
    </div>
  );
};
