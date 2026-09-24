import { describe, expect, it } from 'vitest';
import type { VendorContractRow } from '../useVendorContracts';
import { buildPositionedContracts } from './VendorContractsTimeline';

const row = (
  uid: string,
  name: string,
  contractStart: string | null,
  contractEnd: string | null,
  vendorName: string,
  opts: { autoRenew?: boolean; noticePeriodDays?: number; annualCost?: number } = {}
): VendorContractRow => ({
  contract: {
    _uid: uid,
    _publicId: uid.toUpperCase(),
    _name: name,
    contract_start: contractStart,
    contract_end: contractEnd,
    auto_renew: opts.autoRenew ?? false,
    notice_period_days: opts.noticePeriodDays ?? null,
    annual_cost: opts.annualCost != null ? { amount: opts.annualCost, currency: 'USD' } : null
  } as never,
  vendorId: `vnd-${uid}`,
  vendorName
});

describe('buildPositionedContracts', () => {
  it('positions a contract with both a start and end date', () => {
    const { positioned, excludedCount } = buildPositionedContracts([
      row('ctr-1', 'Acme Support', '2025-01-01', '2026-12-31', 'Acme Corp')
    ]);
    expect(positioned).toHaveLength(1);
    expect(excludedCount).toBe(0);
  });

  it('excludes a contract missing a start or end date, and counts it', () => {
    const { positioned, excludedCount } = buildPositionedContracts([
      row('ctr-1', 'Acme Support', '2025-01-01', '2026-12-31', 'Acme Corp'),
      row('ctr-2', 'Open Ended', '2025-01-01', null, 'Beta Inc')
    ]);
    expect(positioned).toHaveLength(1);
    expect(positioned[0]!.row.contract._uid).toBe('ctr-1');
    expect(excludedCount).toBe(1);
  });

  it('computes a notice-marker date only for an auto-renewing contract', () => {
    const { positioned } = buildPositionedContracts([
      row('ctr-1', 'Auto Renew', '2025-01-01', '2026-12-31', 'Acme Corp', {
        autoRenew: true,
        noticePeriodDays: 60
      }),
      row('ctr-2', 'Fixed Term', '2025-01-01', '2026-12-31', 'Beta Inc', {
        autoRenew: false
      })
    ]);
    const autoRenew = positioned.find(p => p.row.contract._uid === 'ctr-1');
    const fixedTerm = positioned.find(p => p.row.contract._uid === 'ctr-2');
    expect(autoRenew?.noticeDate).not.toBeNull();
    expect(autoRenew?.noticeDate?.getTime()).toBeLessThan(autoRenew!.end.getTime());
    expect(fixedTerm?.noticeDate).toBeNull();
  });
});
