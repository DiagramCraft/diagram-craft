// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import type { DataStewardshipQueueItem } from '../dataStewardshipQueue';
import { DataStewardshipReviewCalendar } from './DataStewardshipReviewCalendar';

const item = (id: string, dueAt: string | null): DataStewardshipQueueItem => ({
  case: {
    id,
    workspace: 'ws-1',
    caseKind: 'field-date-reminder',
    subjectType: 'entity',
    subjectId: 'entity-1',
    subjectVersion: null,
    status: 'open',
    outcome: null,
    policyVersion: null,
    initiatorUserId: null,
    parentCaseId: null,
    selfApprovalAllowed: false,
    payload: { fieldName: 'review_date' },
    initiationFields: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    dueAt,
    completedAt: null,
    cancelledAt: null,
    escalatedAt: null
  } as GovernanceCase,
  assignment: null,
  dataset: { _uid: 'entity-1', _publicId: 'DS-001', _name: 'Customer Records' } as never
});

describe('DataStewardshipReviewCalendar', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // A Monday, so "this week" starts on the system date itself.
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

  it('buckets an item into the week its due date falls in', () => {
    act(() => {
      root.render(
        <DataStewardshipReviewCalendar
          items={[item('case-1', '2026-09-25T00:00:00Z')]}
          onOpenItem={() => {}}
        />
      );
    });
    expect(container.textContent).toContain('Customer Records');
  });

  it('folds an already-overdue item into the current week instead of dropping it', () => {
    act(() => {
      root.render(
        <DataStewardshipReviewCalendar
          items={[item('case-1', '2026-08-01T00:00:00Z')]}
          onOpenItem={() => {}}
        />
      );
    });
    const cells = container.querySelectorAll('[class*="cell"]');
    expect(cells[0]?.textContent).toContain('Customer Records');
  });

  it('drops an item with no due date', () => {
    act(() => {
      root.render(
        <DataStewardshipReviewCalendar items={[item('case-1', null)]} onOpenItem={() => {}} />
      );
    });
    expect(container.textContent).not.toContain('Customer Records');
  });

  it('calls onOpenItem when an entry is clicked', () => {
    const onOpenItem = vi.fn();
    act(() => {
      root.render(
        <DataStewardshipReviewCalendar
          items={[item('case-1', '2026-09-15T00:00:00Z')]}
          onOpenItem={onOpenItem}
        />
      );
    });
    const button = container.querySelector('button');
    act(() => button?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(onOpenItem).toHaveBeenCalledTimes(1);
  });
});
