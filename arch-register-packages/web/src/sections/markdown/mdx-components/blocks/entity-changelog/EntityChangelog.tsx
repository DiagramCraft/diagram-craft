import { useMemo } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useAuditLog } from '../../../../../hooks/useAudit';
import { useWorkspaceContext } from '../../../../../layouts/WorkspaceContext';
import { entityDetailRoute, asEntityPublicId } from '../../../../../routes/publicObjectRoutes';
import type { AuditLogEntry } from '@arch-register/api-types/auditContract';
import styles from './EntityChangelog.module.css';
import { formatRelativeTime } from '../../../../../utils/dateFormat';
import { Table } from '../../../../../components/table/Table';

const OPERATION_LABELS: Record<string, string> = {
  create: 'created',
  update: 'updated',
  delete: 'deleted'
};

const parseSince = (since: string | undefined): string | undefined => {
  if (!since) return undefined;
  const match = /^(\d+)d$/.exec(since);
  if (!match?.[1]) return undefined;
  const days = parseInt(match[1], 10);
  return new Date(Date.now() - days * 86_400_000).toISOString();
};

const parseLimit = (limit: string | undefined): number => {
  const n = limit ? parseInt(limit, 10) : 10;
  return Math.min(Math.max(Number.isFinite(n) ? n : 10, 1), 50);
};

const changedFields = (entry: AuditLogEntry): string[] => {
  if (entry.operation === 'create' || entry.operation === 'delete') return [];
  const oldKeys = new Set(Object.keys(entry.changes.old ?? {}));
  const newKeys = new Set(Object.keys(entry.changes.new ?? {}));
  return [...new Set([...oldKeys, ...newKeys])].filter(k => {
    const o = entry.changes.old?.[k];
    const n = entry.changes.new?.[k];
    return JSON.stringify(o) !== JSON.stringify(n);
  });
};

type Props = {
  id?: string;
  schema?: string;
  owner?: string;
  lifecycle?: string;
  limit?: string;
  since?: string;
};

export const EntityChangelog = ({ id, schema, owner, lifecycle, limit, since }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();

  const hasFilter = !!(id || schema || owner || lifecycle);
  const startDate = useMemo(() => parseSince(since), [since]);
  const limitNum = parseLimit(limit);

  const { data: entries, isLoading } = useAuditLog(
    workspaceSlug,
    {
      entityType: 'entity',
      entityId: id || undefined,
      schemaId: id ? undefined : (schema || undefined),
      owner: id ? undefined : (owner || undefined),
      lifecycle: id ? undefined : (lifecycle || undefined),
      startDate: startDate ?? undefined,
      limit: limitNum
    },
    { enabled: !!workspaceSlug && hasFilter }
  );

  if (!hasFilter) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No entity or filter configured.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={styles.container}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={styles.skeleton} />
        ))}
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className={styles.container}>
        <p className={styles.empty}>No recent changes.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <Table.Root className={styles.tableSurface}>
        <Table.Head>
          <tr>
            <Table.HeaderCell>When</Table.HeaderCell>
            <Table.HeaderCell>Entity</Table.HeaderCell>
            <Table.HeaderCell>Operation</Table.HeaderCell>
            <Table.HeaderCell>By</Table.HeaderCell>
            <Table.HeaderCell>Changed fields</Table.HeaderCell>
          </tr>
        </Table.Head>
        <Table.Body>
          {entries.map(entry => {
            const fields = changedFields(entry);
            return (
              <Table.Row key={entry.id}>
                <Table.Cell>
                  <span title={entry.timestamp}>{formatRelativeTime(entry.timestamp)}</span>
                </Table.Cell>
                <Table.Cell>
                  {entry.public_id ? (
                    <button
                      type="button"
                      className={styles.entityLink}
                      onClick={() =>
                        navigate(
                          entityDetailRoute(workspaceSlug, asEntityPublicId(entry.public_id!))
                        )
                      }
                    >
                      {entry.entity_name}
                    </button>
                  ) : (
                    entry.entity_name
                  )}
                </Table.Cell>
                <Table.Cell>
                  <span className={`${styles.op} ${styles[`op_${entry.operation}`]}`}>
                    {OPERATION_LABELS[entry.operation] ?? entry.operation}
                  </span>
                </Table.Cell>
                <Table.Cell>{entry.user_display_name ?? '—'}</Table.Cell>
                <Table.Cell>{fields.length > 0 ? fields.join(', ') : '—'}</Table.Cell>
              </Table.Row>
            );
          })}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
