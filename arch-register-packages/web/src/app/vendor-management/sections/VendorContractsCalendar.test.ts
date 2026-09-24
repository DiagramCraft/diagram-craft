import { describe, expect, it } from 'vitest';
import type { VendorContractRow } from '../useVendorContracts';
import { buildContractCalendarMonths } from './VendorContractsCalendar';

const row = (
  uid: string,
  name: string,
  contractEnd: string | null,
  vendorName: string,
  annualCost?: number
): VendorContractRow => ({
  contract: {
    _uid: uid,
    _publicId: uid.toUpperCase(),
    _name: name,
    contract_end: contractEnd,
    annual_cost: annualCost != null ? { amount: annualCost, currency: 'USD' } : null
  } as never,
  vendorId: `vnd-${uid}`,
  vendorName
});

describe('buildContractCalendarMonths', () => {
  const today = new Date('2026-09-14T00:00:00Z');

  it('buckets a contract into its renewal month', () => {
    const { months } = buildContractCalendarMonths(
      [row('ctr-1', 'Acme Support', '2026-10-05', 'Acme Corp')],
      today
    );
    const october = months.find(m => m.rows.some(r => r.contract._uid === 'ctr-1'));
    expect(october?.label).toContain('October 2026');
  });

  it('folds an overdue contract into the current month', () => {
    const { months } = buildContractCalendarMonths(
      [row('ctr-1', 'Overdue Contract', '2026-08-01', 'Acme Corp')],
      today
    );
    const current = months.find(m => m.rows.some(r => r.contract._uid === 'ctr-1'));
    expect(current?.label).toContain('September 2026');
  });

  it('excludes a contract with no end date, and counts it separately', () => {
    const { months, noEndDateCount } = buildContractCalendarMonths(
      [row('ctr-1', 'Open Ended', null, 'Acme Corp')],
      today
    );
    expect(months.some(m => m.rows.some(r => r.contract._uid === 'ctr-1'))).toBe(false);
    expect(noEndDateCount).toBe(1);
  });

  it('excludes a contract renewing beyond 12 months, and counts it separately', () => {
    const { months, beyondCount } = buildContractCalendarMonths(
      [row('ctr-1', 'Far Future', '2028-01-01', 'Acme Corp')],
      today
    );
    expect(months.some(m => m.rows.some(r => r.contract._uid === 'ctr-1'))).toBe(false);
    expect(beyondCount).toBe(1);
  });

  it("sums a month's rows for the header total", () => {
    const { months } = buildContractCalendarMonths(
      [
        row('ctr-1', 'Acme Support', '2026-10-05', 'Acme Corp', 1000),
        row('ctr-2', 'Beta Maintenance', '2026-10-20', 'Beta Inc', 500)
      ],
      today
    );
    const october = months.find(m => m.key === '2026-10');
    const total = october?.rows.reduce(
      (sum, r) => sum + (r.contract.annual_cost as { amount: number }).amount,
      0
    );
    expect(total).toBe(1500);
  });
});
