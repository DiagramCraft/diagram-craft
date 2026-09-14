// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VendorContractRow } from '../useVendorContracts';
import { VendorContractsCalendar } from './VendorContractsCalendar';

const row = (uid: string, name: string, contractEnd: string | null, vendorName: string): VendorContractRow => ({
  contract: { _uid: uid, _publicId: uid.toUpperCase(), _name: name, contract_end: contractEnd } as never,
  vendorId: `vnd-${uid}`,
  vendorName
});

describe('VendorContractsCalendar', () => {
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

  it('buckets contracts into their renewal month', () => {
    act(() => {
      root.render(
        <VendorContractsCalendar
          contracts={[row('ctr-1', 'Acme Support', '2026-10-05', 'Acme Corp')]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('October 2026');
    expect(container.textContent).toContain('Acme Support');
  });

  it('folds an overdue contract into the current month', () => {
    act(() => {
      root.render(
        <VendorContractsCalendar
          contracts={[row('ctr-1', 'Overdue Contract', '2026-08-01', 'Acme Corp')]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).toContain('September 2026');
    expect(container.textContent).toContain('Overdue Contract');
  });

  it('excludes a contract with no end date, and counts it in the caption', () => {
    act(() => {
      root.render(
        <VendorContractsCalendar
          contracts={[row('ctr-1', 'Open Ended', null, 'Acme Corp')]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).not.toContain('Open Ended');
    expect(container.textContent).toContain('1 have no end date');
  });

  it('excludes a contract renewing beyond 12 months, and counts it in the caption', () => {
    act(() => {
      root.render(
        <VendorContractsCalendar
          contracts={[row('ctr-1', 'Far Future', '2028-01-01', 'Acme Corp')]}
          onOpenContract={() => {}}
        />
      );
    });

    expect(container.textContent).not.toContain('Far Future');
    expect(container.textContent).toContain('1 renew beyond the next 12 months');
  });

  it('invokes onOpenContract when an entry is clicked', () => {
    const onOpenContract = vi.fn();
    act(() => {
      root.render(
        <VendorContractsCalendar
          contracts={[row('ctr-1', 'Acme Support', '2026-10-05', 'Acme Corp')]}
          onOpenContract={onOpenContract}
        />
      );
    });

    const entry = [...container.querySelectorAll('button')].find(btn =>
      btn.textContent?.includes('Acme Support')
    );
    expect(entry).toBeDefined();
    act(() => {
      entry!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onOpenContract).toHaveBeenCalledWith(
      expect.objectContaining({ _uid: 'ctr-1', _name: 'Acme Support' })
    );
  });
});
