import { firstScalarValue } from '../../../lib/scalarFieldValues';
import { measuredValue } from './fieldAggregation';

export type RollupRow = {
  key: string;
  label: string;
  /** Public id of the record when the row is a single entity (no grouping). */
  entityPublicId?: string;
  amount: number;
  currency?: string;
  count: number;
};

export type RollupResult = {
  rows: RollupRow[];
  totalAmount: number;
  totalCurrency?: string;
  totalCount: number;
};

type Options = {
  /** Field to group by; blank groups nothing - one row per record. */
  groupFieldId?: string;
  valueFieldId: string;
  /** Maps a raw group value to a display label (e.g. select option label). */
  groupLabel?: (value: string) => string;
  /** Group key shown for records with no value in the group field. */
  emptyGroupLabel?: string;
};

/**
 * Rolls records up into rows of summed `valueFieldId`, sorted descending. A row's currency is kept
 * only when every contributing value shares it.
 */
export const buildRollupRows = (
  records: ReadonlyArray<Record<string, unknown>>,
  { groupFieldId, valueFieldId, groupLabel, emptyGroupLabel = '—' }: Options
): RollupResult => {
  const byKey = new Map<string, RollupRow & { currencyInit: boolean }>();

  for (const record of records) {
    const groupValue = groupFieldId ? firstScalarValue(record[groupFieldId]) : undefined;
    const rawGroup =
      typeof groupValue === 'string' || typeof groupValue === 'number' ? String(groupValue) : '';
    const key = groupFieldId ? rawGroup : String(record._uid);
    const label = groupFieldId
      ? rawGroup === ''
        ? emptyGroupLabel
        : (groupLabel?.(rawGroup) ?? rawGroup)
      : String(record._name ?? key);

    let row = byKey.get(key);
    if (!row) {
      row = {
        key,
        label,
        entityPublicId: groupFieldId ? undefined : String(record._publicId),
        amount: 0,
        count: 0,
        currencyInit: false
      };
      byKey.set(key, row);
    }
    row.count += 1;
    const value = measuredValue(record[valueFieldId]);
    if (!value) continue;
    row.amount += value.amount;
    if (!row.currencyInit) {
      row.currency = value.currency;
      row.currencyInit = true;
    } else if (row.currency !== value.currency) {
      row.currency = undefined;
    }
  }

  const rows: RollupRow[] = [...byKey.values()]
    .map(row => ({
      key: row.key,
      label: row.label,
      entityPublicId: row.entityPublicId,
      amount: row.amount,
      currency: row.currency,
      count: row.count
    }))
    .sort((a, b) => b.amount - a.amount);

  const currencies = new Set(rows.filter(row => row.amount !== 0).map(row => row.currency));
  return {
    rows,
    totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    totalCurrency: currencies.size === 1 ? [...currencies][0] : undefined,
    totalCount: rows.reduce((sum, row) => sum + row.count, 0)
  };
};
