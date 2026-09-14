import { useMemo } from 'react';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { Chip } from '../../../components/Chip';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import type { VendorContractRow } from '../useVendorContracts';
import { renewalWindow, RENEWAL_WINDOW_COLOR } from '../contractRenewalWindow';
import styles from './VendorContractsCalendar.module.css';

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

const monthKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

type MonthBucket = {
  key: string;
  label: string;
  isCurrent: boolean;
  rows: VendorContractRow[];
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

  const { months, beyondCount, noEndDateCount } = useMemo(() => {
    const currentMonthStart = startOfMonth(today);
    const currentKey = monthKey(currentMonthStart);
    const monthStarts: Date[] = [];
    for (let i = 0; i < 12; i++) {
      monthStarts.push(
        new Date(currentMonthStart.getFullYear(), currentMonthStart.getMonth() + i, 1)
      );
    }
    const lastKey = monthKey(monthStarts[monthStarts.length - 1]!);

    const buckets = new Map<string, MonthBucket>(
      monthStarts.map(start => {
        const key = monthKey(start);
        return [
          key,
          { key, label: MONTH_LABEL.format(start), isCurrent: key === currentKey, rows: [] }
        ];
      })
    );

    let beyond = 0;
    let noEndDate = 0;
    for (const row of contracts) {
      const contractEnd =
        typeof row.contract.contract_end === 'string' ? row.contract.contract_end : null;
      if (!contractEnd) {
        noEndDate++;
        continue;
      }
      const end = new Date(`${contractEnd.slice(0, 10)}T00:00:00`);
      if (Number.isNaN(end.getTime())) {
        noEndDate++;
        continue;
      }
      const key = end < currentMonthStart ? currentKey : monthKey(end);
      if (key > lastKey) {
        beyond++;
        continue;
      }
      buckets.get(key)?.rows.push(row);
    }

    return { months: [...buckets.values()], beyondCount: beyond, noEndDateCount: noEndDate };
  }, [contracts, today]);

  return (
    <div>
      <div className={styles.grid}>
        {months.map(month => (
          <div
            key={month.key}
            className={month.isCurrent ? `${styles.cell} ${styles.currentCell}` : styles.cell}
          >
            <div className={styles.cellHeader}>
              <span>{month.label}</span>
              <span className="dim mono">{month.rows.length}</span>
            </div>
            {month.rows.length === 0 ? (
              <div className={`${styles.empty} dim`}>No renewals</div>
            ) : (
              <div className={styles.entries}>
                {month.rows.map(({ contract, vendorName }) => {
                  const contractWindow = renewalWindow(
                    typeof contract.contract_end === 'string' ? contract.contract_end : null
                  );
                  return (
                    <button
                      key={contract._uid}
                      type="button"
                      className={styles.entry}
                      onClick={() => onOpenContract(contract)}
                      title={vendorName ?? undefined}
                    >
                      <Chip dot={RENEWAL_WINDOW_COLOR[contractWindow]} tone="ghost">
                        {contract._name}
                      </Chip>
                      {vendorName && <span className={styles.entryVendor}>{vendorName}</span>}
                      {contract.annual_cost != null && typeof contract.annual_cost === 'object' && (
                        <span className={`${styles.entryCost} dim mono`}>
                          {formatCurrencyValue(contract.annual_cost)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
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
