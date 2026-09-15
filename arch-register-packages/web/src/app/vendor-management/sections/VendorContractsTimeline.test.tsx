// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorContractRow } from '../useVendorContracts';
import { VendorContractsTimeline } from './VendorContractsTimeline';

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

describe('VendorContractsTimeline', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-09-14T00:00:00Z'));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it('renders a bar for a contract with both a start and end date', () => {
    act(() => {
      root.render(
        <VendorContractsTimeline
          contracts={[
            row('ctr-1', 'Acme Support', '2025-01-01', '2026-12-31', 'Acme Corp', {
              annualCost: 50000
            })
          ]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).toContain('Acme Corp');
    const bar = [...container.querySelectorAll('button')].find(btn =>
      btn.title?.includes('Acme Support')
    );
    expect(bar).toBeDefined();
  });

  it('excludes a contract missing a start or end date, and counts it in the caption', () => {
    act(() => {
      root.render(
        <VendorContractsTimeline
          contracts={[
            row('ctr-1', 'Acme Support', '2025-01-01', '2026-12-31', 'Acme Corp'),
            row('ctr-2', 'Open Ended', '2025-01-01', null, 'Beta Inc')
          ]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('Acme Support');
    expect(container.textContent).not.toContain('Open Ended');
    expect(container.textContent).toContain('1 contract missing a start or end date');
  });

  it('shows a notice-period marker only for an auto-renewing contract', () => {
    act(() => {
      root.render(
        <VendorContractsTimeline
          contracts={[
            row('ctr-1', 'Auto Renew', '2025-01-01', '2026-12-31', 'Acme Corp', {
              autoRenew: true,
              noticePeriodDays: 60
            }),
            row('ctr-2', 'Fixed Term', '2025-01-01', '2026-12-31', 'Beta Inc', {
              autoRenew: false
            })
          ]}
          onOpenContract={() => {}}
        />
      );
    });

    const notice = container.querySelector('[title$="60 day notice"]');
    expect(notice).toBeDefined();
  });

  it('invokes onOpenContract when a bar is clicked', () => {
    const onOpenContract = vi.fn();
    act(() => {
      root.render(
        <VendorContractsTimeline
          contracts={[row('ctr-1', 'Acme Support', '2025-01-01', '2026-12-31', 'Acme Corp')]}
          onOpenContract={onOpenContract}
        />
      );
    });

    const bar = [...container.querySelectorAll('button')].find(btn =>
      btn.title?.includes('Acme Support')
    );
    act(() => {
      bar!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenContract).toHaveBeenCalledWith(
      expect.objectContaining({ _uid: 'ctr-1', _name: 'Acme Support' })
    );
  });

  it('shows an empty state when no contracts have both dates', () => {
    act(() => {
      root.render(
        <VendorContractsTimeline
          contracts={[row('ctr-1', 'Open Ended', '2025-01-01', null, 'Acme Corp')]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('No contracts with both a start and end date');
  });
});
