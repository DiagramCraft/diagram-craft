import { useState } from 'react';
import { Banner } from '../../../components/Banner';
import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Pagination } from '../../../components/Pagination';
import { Table } from '../../../components/table/Table';
import { useAuthEvents } from '../../../hooks/useAuthEvents';
import { useDateTimeFormatPreference } from '../../../hooks/useDateTimeFormatPreference';
import { formatDateTime } from '../../../utils/dateFormat';
import type { AuthEvent } from '@arch-register/api-types/authContract';

const EVENT_LABELS: Record<AuthEvent['event'], { label: string; dot: string }> = {
  login_success: { label: 'Sign-in', dot: 'var(--green)' },
  login_failed: { label: 'Failed sign-in', dot: 'var(--warning-fg)' },
  login_throttled: { label: 'Blocked (rate limit)', dot: 'var(--error-fg)' },
  account_locked: { label: 'Account locked', dot: 'var(--error-fg)' },
  account_unlocked: {
    label: 'Account unlocked',
    dot: 'var(--cmp-fg-disabled)'
  }
};

export const SecurityEventsSubSection = () => {
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const dateTimeFormatPreference = useDateTimeFormatPreference();
  const {
    data: events = [],
    isLoading,
    error
  } = useAuthEvents({
    limit: pageSize,
    offset: page * pageSize
  });

  if (error) {
    return (
      <div>
        <Banner variant="error">Failed to load security events.</Banner>
      </div>
    );
  }

  return (
    <div>
      {isLoading ? (
        <LoadingState text="Loading security events…" size="sm" />
      ) : events.length === 0 && page === 0 ? (
        <EmptyState title="No security events have been recorded yet." />
      ) : (
        <>
          <Table.Root>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Time</Table.HeaderCell>
                <Table.HeaderCell>Event</Table.HeaderCell>
                <Table.HeaderCell>Username</Table.HeaderCell>
                <Table.HeaderCell>IP address</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {events.map(event => {
                const meta = EVENT_LABELS[event.event];
                return (
                  <Table.Row key={event.id}>
                    <Table.Cell>
                      {formatDateTime(event.created_at, '—', dateTimeFormatPreference)}
                    </Table.Cell>
                    <Table.Cell>
                      <Chip tone="ghost" dot={meta.dot}>
                        {meta.label}
                      </Chip>
                    </Table.Cell>
                    <Table.Cell>{event.username ?? '—'}</Table.Cell>
                    <Table.Cell>{event.ip ?? '—'}</Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
          <Pagination
            pageSize={pageSize}
            onPageSizeChange={size => {
              setPageSize(size);
              setPage(0);
            }}
            canGoPrev={page > 0}
            canGoNext={events.length === pageSize}
            onPrev={() => setPage(p => Math.max(p - 1, 0))}
            onNext={() => setPage(p => p + 1)}
          />
        </>
      )}
    </div>
  );
};
