import { TbShieldCheck } from 'react-icons/tb';
import { useConformanceViolations } from '../../../hooks/useConformance';
import { SeverityBadge, ViolationStatusChip } from '../../../components/ConformanceBadges';
import { EmptyState } from '../../../components/EmptyState';
import { LoadingState } from '../../../components/LoadingState';
import { Table } from '../../../components/table/Table';
import { formatDateTime } from '../../../utils/dateFormat';
import { EntityTabPage } from './EntityTabPage';

type Props = {
  workspaceId: string;
  entityId: string;
  canViewConformance: boolean;
};

export const EntityConformanceTab = ({ workspaceId, entityId, canViewConformance }: Props) => {
  const { data, isLoading } = useConformanceViolations(
    workspaceId,
    { entityId, limit: 200, offset: 0 },
    canViewConformance
  );

  if (!canViewConformance) {
    return (
      <EmptyState
        dense
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
        dense
        icon={<TbShieldCheck size={20} />}
        tone="good"
        title="Conformant"
        subtitle="No active, acknowledged, or exempt violations were found for this entity."
      />
    );
  }

  return (
    <EntityTabPage>
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
    </EntityTabPage>
  );
};
