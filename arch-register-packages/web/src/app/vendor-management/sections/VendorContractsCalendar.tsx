import { useMemo } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import { bucketByPeriod } from '../../../utils/calendarBuckets';
import { CalendarGrid } from '../../../components/CalendarGrid';
import type { VendorContractRow } from '../useVendorContracts';
import { renewalWindow, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import styles from './VendorContractsCalendar.module.css';

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

const currencyAmount = (value: unknown): { amount: number; currency: string } | null =>
  value != null &&
  typeof value === 'object' &&
  typeof (value as { amount?: unknown }).amount === 'number' &&
  typeof (value as { currency?: unknown }).currency === 'string'
    ? (value as { amount: number; currency: string })
    : null;

/** Sum of a month's contract values, formatted in the first contract's own currency (contracts
 *  are assumed single-currency in practice, same simplifying assumption `VendorSpendScreen.tsx`
 *  makes) — `null` when the month has no contracts with a parseable `annual_cost`. */
const monthTotal = (rows: readonly VendorContractRow[]): string | null => {
  let total = 0;
  let currency: string | null = null;
  for (const { contract } of rows) {
    const value = currencyAmount(contract.annual_cost);
    if (!value) continue;
    total += value.amount;
    currency ??= value.currency;
  }
  return currency ? formatCurrencyValue({ amount: total, currency }) : null;
};

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

type MonthBucket = {
  key: string;
  label: string;
  rows: VendorContractRow[];
};

/**
 * A 12-month grid (current month + next 11), one cell per month, bucketing the given contracts by
 * the calendar month of `contract_end`. A contract already overdue (its `contract_end` before the
 * start of the current month) is folded into the current month's cell instead of disappearing off
 * the front of the grid; a contract renewing more than 12 months out, or with no `contract_end` at
 * all, is excluded from the grid and counted separately.
 */
export const buildContractCalendarMonths = (
  contracts: readonly VendorContractRow[],
  today: Date
): { months: MonthBucket[]; beyondCount: number; noEndDateCount: number } => {
  const getContractEnd = (row: VendorContractRow): Date | null => {
    const contractEnd =
      typeof row.contract.contract_end === 'string' ? row.contract.contract_end : null;
    return contractEnd ? new Date(`${contractEnd.slice(0, 10)}T00:00:00`) : null;
  };

  const { buckets, beyondCount, unbucketedCount } = bucketByPeriod({
    items: contracts,
    today,
    periodCount: 12,
    getItemDate: getContractEnd,
    startOfPeriod: startOfMonth,
    periodStartAt: (currentPeriodStart, index) =>
      new Date(currentPeriodStart.getFullYear(), currentPeriodStart.getMonth() + index, 1),
    periodKey: monthKey,
    periodLabel: periodStart => MONTH_LABEL.format(periodStart)
  });

  return {
    months: buckets.map(({ key, label, items }) => ({ key, label, rows: items })),
    beyondCount,
    noEndDateCount: unbucketedCount
  };
};

/**
 * A 12-month grid (current month + next 11), one cell per month, bucketing the given contracts by
 * the calendar month of `contract_end`. A contract already overdue (its `contract_end` before the
 * start of the current month) is folded into the current month's cell instead of disappearing off
 * the front of the grid, so nothing due is ever missing from view; a contract renewing more than
 * 12 months out, or with no `contract_end` at all, is excluded from the grid and counted in the
 * caption below it — both are still visible in the list view.
 *
 * No existing month-grid/calendar component exists elsewhere in the repo to build on (see #3260's
 * plan) — this is new, purpose-built for the renewal use case rather than a generic calendar.
 */
export const VendorContractsCalendar = ({
  contracts,
  onOpenContract
}: {
  contracts: readonly VendorContractRow[];
  onOpenContract: (contract: EntityRecord) => void;
}) => {
  const today = useMemo(() => new Date(), []);

  const { months, beyondCount, noEndDateCount } = useMemo(
    () => buildContractCalendarMonths(contracts, today),
    [contracts, today]
  );

  return (
    <div>
      <CalendarGrid
        columns={4}
        collapseColumns={2}
        collapseBreakpoint={1100}
        cellClassName={styles.cell}
        cells={months.map(month => ({
          key: month.key,
          label: <span className={styles.cellLabel}>{month.label}</span>,
          headerRight: (
            <span className={`${styles.cellLabel} dim mono tabular`}>
              {monthTotal(month.rows) ?? '—'}
            </span>
          ),
          children:
            month.rows.length === 0 ? (
              <div className={`${styles.empty} dim`}>No renewals</div>
            ) : (
              <div className={styles.entries}>
                {month.rows.map(({ contract, vendorName }) => {
                  const contractEnd =
                    typeof contract.contract_end === 'string' ? contract.contract_end : null;
                  const contractWindow = renewalWindow(contractEnd);
                  const day = contractEnd ? new Date(`${contractEnd.slice(0, 10)}T00:00:00`) : null;
                  return (
                    <button
                      key={contract._uid}
                      type="button"
                      className={styles.entry}
                      style={
                        { '--tone': RENEWAL_WINDOW_COLOR[contractWindow] } as React.CSSProperties
                      }
                      onClick={() => onOpenContract(contract)}
                    >
                      <span className="dim mono tabular">{day ? day.getDate() : '—'}</span>
                      <span className={styles.entryMain}>
                        <span className={styles.entryName}>{vendorName ?? contract._name}</span>
                        {vendorName && (
                          <span className={`${styles.entrySub} dim`}>{contract._name}</span>
                        )}
                      </span>
                      {contract.annual_cost != null && typeof contract.annual_cost === 'object' && (
                        <span className="dim mono tabular">
                          {formatCurrencyValue(contract.annual_cost)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )
        }))}
      />
      {(beyondCount > 0 || noEndDateCount > 0) && (
        <div className={`${styles.caption} dim`}>
          {beyondCount > 0 && <span>{beyondCount} renew beyond the next 12 months. </span>}
          {noEndDateCount > 0 && <span>{noEndDateCount} have no end date. </span>}
          See the list view for these.
        </div>
      )}
    </div>
  );
};
