import type { ReactNode } from 'react';
import { TbHistory } from 'react-icons/tb';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { formatRelativeTime } from '../../../utils/dateFormat';

export type VersionHistoryEntry = {
  version: number;
  createdAt: string;
  /** Description lines shown under the version number, most important first. */
  lines: string[];
  action?: ReactNode;
};

/** Shared layout of every version history dialog. */
export const VersionHistoryList = ({
  entries,
  isLoading,
  emptySubtitle,
  testId
}: {
  entries: VersionHistoryEntry[] | undefined;
  isLoading: boolean;
  emptySubtitle: string;
  testId?: string;
}) => {
  if (isLoading) return <LoadingState text="Loading version history..." />;

  if (!entries || entries.length === 0) {
    return (
      <EmptyState
        icon={<TbHistory size={22} />}
        title="No version history yet"
        subtitle={emptySubtitle}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }} data-testid={testId}>
      {entries.map(entry => (
        <div
          key={entry.version}
          style={{
            display: 'grid',
            gap: 4,
            padding: '12px 16px',
            border: '1px solid var(--cmp-border)',
            borderRadius: 6,
            background: 'var(--base-bg)'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              fontSize: 12
            }}
          >
            <div>
              <span>
                <span style={{ fontWeight: 600 }}>Version {entry.version}</span>
                <span style={{ color: 'var(--panel-fg-tertiary)' }}>
                  &nbsp;&nbsp;{formatRelativeTime(entry.createdAt)}
                </span>
              </span>
              {entry.lines.map((line, index) => (
                <div key={index} style={{ fontSize: 12, color: 'var(--panel-fg-secondary)' }}>
                  {line}
                </div>
              ))}
            </div>
            {entry.action}
          </div>
        </div>
      ))}
    </div>
  );
};
