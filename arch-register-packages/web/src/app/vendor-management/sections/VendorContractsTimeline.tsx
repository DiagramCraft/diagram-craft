import { useMemo } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { formatDate } from '../../../utils/dateFormat';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import type { VendorContractRow } from '../useVendorContracts';
import { renewalWindow, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import {
  SnapshotTimelineShell,
  useSnapshotTimeline
} from '../../../components/timeline/SnapshotTimeline';
import {
  parseTimelineDate,
  stringDateToTimelinePx,
  type TimelineColumnWidths
} from '../../../components/timeline/timelineUtils';
import styles from './VendorContractsTimeline.module.css';

const LABEL_WIDTH = 220;
const COLUMN_WIDTHS: TimelineColumnWidths = { month: 72, quarter: 100, year: 136 };
// Minimum on-screen bar width (px) so a very short contract term is still clickable/visible.
const MIN_BAR_WIDTH = 6;

type PositionedContract = {
  row: VendorContractRow;
  start: Date;
  end: Date;
  noticeDate: Date | null;
};

const subtractDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
};

/**
 * Contract terms as a Gantt chart: one row per contract, a bar spanning `contract_start` →
 * `contract_end`, a notice-period marker on auto-renewing contracts, and a today line — over a
 * fixed multi-year window sized to the contracts actually shown (not re-fit as you scroll).
 *
 * Built on the same shared timeline primitives the Projects roadmap view uses
 * (`components/timeline/{timelineUtils,SnapshotTimeline,TimelineScaffold}`) rather than bespoke
 * date-axis math — `useSnapshotTimeline` gives the column/axis/today-position layout for free, and
 * a contract's bar is just two `stringDateToTimelinePx` calls (start, end) instead of the single
 * point-in-time marker that hook's other consumer (`ProjectTimelineTab.tsx`) renders.
 *
 * Only contracts with both a `contract_start` and a parseable `contract_end` can be drawn as a bar
 * — those without either are excluded from the chart and counted in the caption below it, mirroring
 * `VendorContractsCalendar.tsx`'s "beyond/no end date" caption (both remain visible in the list).
 */
export const VendorContractsTimeline = ({
  contracts,
  onOpenContract
}: {
  contracts: readonly VendorContractRow[];
  onOpenContract: (contract: EntityRecord) => void;
}) => {
  const today = useMemo(() => new Date(), []);
  const dateTimeFormatPreference = useDateTimeFormatPreference();

  const { positioned, excludedCount } = useMemo(() => {
    const positionedRows: PositionedContract[] = [];
    let excluded = 0;
    for (const row of contracts) {
      const start = parseTimelineDate(
        typeof row.contract.contract_start === 'string' ? row.contract.contract_start : null
      );
      const end = parseTimelineDate(
        typeof row.contract.contract_end === 'string' ? row.contract.contract_end : null
      );
      if (!start || !end) {
        excluded++;
        continue;
      }
      const noticeDays =
        typeof row.contract.notice_period_days === 'number'
          ? row.contract.notice_period_days
          : null;
      const noticeDate =
        row.contract.auto_renew === true && noticeDays != null
          ? subtractDays(end, noticeDays)
          : null;
      positionedRows.push({ row, start, end, noticeDate });
    }
    return { positioned: positionedRows, excludedCount: excluded };
  }, [contracts]);

  const dates = useMemo(() => positioned.flatMap(({ start, end }) => [start, end]), [positioned]);

  const timeline = useSnapshotTimeline({
    dates,
    zoom: 'year',
    columnWidths: COLUMN_WIDTHS,
    today
  });

  if (positioned.length === 0) {
    return (
      <div className={`${styles.empty} dim`}>
        {excludedCount > 0
          ? 'No contracts with both a start and end date to plot. See the list view for these.'
          : 'No contracts to plot.'}
      </div>
    );
  }

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
        cornerLabel={`${positioned.length} contract${positioned.length === 1 ? '' : 's'}`}
        showMilestones={false}
      >
        {positioned.map(({ row, start, end, noticeDate }) => {
          const { contract, vendorName } = row;
          const startPx = stringDateToTimelinePx(
            typeof contract.contract_start === 'string' ? contract.contract_start : null,
            timeline.rangeStart,
            timeline.rangeEnd,
            timeline.totalWidth
          );
          const endPx = stringDateToTimelinePx(
            typeof contract.contract_end === 'string' ? contract.contract_end : null,
            timeline.rangeStart,
            timeline.rangeEnd,
            timeline.totalWidth
          );
          if (startPx === null || endPx === null) return null;
          const width = Math.max(MIN_BAR_WIDTH, endPx - startPx);
          const tone = RENEWAL_WINDOW_COLOR[renewalWindow(contract.contract_end as string)];
          const noticePx =
            noticeDate &&
            stringDateToTimelinePx(
              noticeDate.toISOString().slice(0, 10),
              timeline.rangeStart,
              timeline.rangeEnd,
              timeline.totalWidth
            );

          return (
            <div key={contract._uid} className={styles.row}>
              <div className={styles.label}>
                <span className={styles.name}>{contract._name}</span>
                {vendorName && <span className={styles.vendor}>{vendorName}</span>}
              </div>
              <div className={styles.track} style={{ width: timeline.totalWidth }}>
                <button
                  type="button"
                  className={styles.bar}
                  style={{ left: startPx, width, background: tone }}
                  onClick={() => onOpenContract(contract)}
                  title={`${contract._name} · ${formatDate(start, '—', dateTimeFormatPreference)} → ${formatDate(end, '—', dateTimeFormatPreference)}`}
                >
                  <span className={styles.barLabel}>
                    {contract.annual_cost != null && typeof contract.annual_cost === 'object'
                      ? formatCurrencyValue(contract.annual_cost)
                      : null}
                  </span>
                </button>
                {noticePx != null && (
                  <span
                    className={styles.notice}
                    style={{ left: noticePx }}
                    title={`${contract.notice_period_days} day notice`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </SnapshotTimelineShell>

      {excludedCount > 0 && (
        <div className={`${styles.caption} dim`}>
          {excludedCount} contract{excludedCount === 1 ? '' : 's'} missing a start or end date — not
          shown here. See the list view for these.
        </div>
      )}
    </div>
  );
};
