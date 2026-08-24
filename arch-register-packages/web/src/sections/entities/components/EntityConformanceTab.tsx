import { useNavigate } from '@tanstack/react-router';
import { TbArrowRight, TbShieldCheck } from 'react-icons/tb';
import { useConformanceViolations } from '../../../hooks/useConformance';
import { SeverityBadge, ViolationStatusChip } from '../../../components/ConformanceBadges';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Table } from '../../../components/table/Table';
import { formatDateTime } from '../../../utils/dateFormat';
import styles from './EntityConformanceTab.module.css';

type Props = {
  workspaceId: string;
  entityId: string;
  canViewConformance: boolean;
};

export const EntityConformanceTab = ({ workspaceId, entityId, canViewConformance }: Props) => {
  const navigate = useNavigate();
  const { data, isLoading } = useConformanceViolations(
    workspaceId,
    { entityId, limit: 200, offset: 0 },
    canViewConformance
  );

  const goToConformance = () =>
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug: workspaceId, section: 'conformance' }
    });

  if (!canViewConformance) {
    return (
      <EmptyState
        title="No access to conformance"
        subtitle="You do not have permission to view conformance results for this entity."
      />
    );
  }

  if (isLoading) {
    return <LoadingState text="Loading conformance status..." size="sm" />;
  }

  const violations = data?.items ?? [];

  if (violations.length === 0) {
    return (
      <EmptyState
        icon={<TbShieldCheck size={20} />}
        title="Conformant"
        subtitle="No active, acknowledged, or exempt violations were found for this entity."
        action={
          <button type="button" className={styles.link} onClick={goToConformance}>
            View in Conformance <TbArrowRight size={12} />
          </button>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <Table.Root>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Check</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
            <Table.HeaderCell>Severity</Table.HeaderCell>
            <Table.HeaderCell>Message</Table.HeaderCell>
            <Table.HeaderCell>Last seen</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {violations.map(violation => (
            <Table.Row key={violation.id}>
              <Table.Cell>{violation.check_name}</Table.Cell>
              <Table.Cell>
                <ViolationStatusChip status={violation.status} />
              </Table.Cell>
              <Table.Cell>
                <SeverityBadge severity={violation.severity} />
              </Table.Cell>
              <Table.Cell>{violation.message}</Table.Cell>
              <Table.Cell>{formatDateTime(violation.last_seen_at)}</Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>
      <button type="button" className={styles.link} onClick={goToConformance}>
        View in Conformance <TbArrowRight size={12} />
      </button>
    </div>
  );
};
