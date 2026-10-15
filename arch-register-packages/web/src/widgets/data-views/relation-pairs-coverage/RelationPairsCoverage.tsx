import { Chip } from '../../../components/Chip';
import { EmptyState } from '../../../components/EmptyState';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import { useWidgetFramed } from '../../shared/dashboard/WidgetFramed';
import { type RelationPair } from './relationPairCoverageLogic';
import { useRelationPairCoverage } from './useRelationPairCoverage';
import { RelationPairsCoverageWidgetConfig } from './types';

const WARN = 'var(--cmp-fg-warning, #eab308)';

type SortKey = 'consumer';

/**
 * Every provider × consumer pairing around each hub entity (e.g. every System providing × every
 * System consuming a given API), with a flag for whether a coverage relation (e.g. a Data Flow)
 * exists between the two (the gap count alone is the `RelationPairGaps` metric). Not tied to any application: any hub schema with two typed-relation
 * fields and any relation type can be configured.
 */
export const RelationPairsCoverageWidget = ({
  config
}: {
  config: RelationPairsCoverageWidgetConfig;
}) => {
  const framed = useWidgetFramed();
  const { hubSchema, providerSchemaId, consumerSchemaId, coverageSchemaId, pairs, isLoading } =
    useRelationPairCoverage(config);
  const { sorted, sort, toggleSort } = useTableSort<RelationPair, SortKey>(
    pairs,
    { consumer: (a, b) => a.consumer.name.localeCompare(b.consumer.name) },
    { key: 'consumer', dir: 'asc' }
  );

  if (!hubSchema || providerSchemaId == null || consumerSchemaId == null) {
    return (
      <EmptyState
        title="Provider and consumer relations not found"
        subtitle={`'${config.hubSchemaName}' needs typed-relation fields '${config.providerFieldName}' and '${config.consumerFieldName}'.`}
        compact
      />
    );
  }
  if (coverageSchemaId == null) {
    return (
      <EmptyState
        title={`Relation type '${config.coverageRelationSchemaName}' not found`}
        compact
      />
    );
  }

  return (
    <Table.Root scroll stickyHeader bordered={!framed}>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="consumer" sort={sort} onSort={toggleSort}>
            {config.consumerLabel ?? 'Consumer'}
          </Table.SortableHeaderCell>
          <Table.HeaderCell>{config.hubLabel ?? hubSchema.name}</Table.HeaderCell>
          <Table.HeaderCell>{config.providerLabel ?? 'Provider'}</Table.HeaderCell>
          <Table.HeaderCell>
            {config.coverageLabel ?? config.coverageRelationSchemaName}
          </Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={4}>
            {isLoading ? 'Loading…' : `No ${hubSchema.name} is both provided and consumed.`}
          </Table.EmptyRow>
        ) : (
          sorted.map(pair => (
            <Table.Row key={pair.key}>
              <Table.NameCell title={pair.consumer.name} />
              <Table.Cell className="dim">{pair.hub.name}</Table.Cell>
              <Table.Cell className="dim">{pair.provider.name}</Table.Cell>
              <Table.Cell>
                {!pair.coverageApplicable ? (
                  <span className="dim">n/a (endpoint type)</span>
                ) : pair.hasCoverage ? (
                  <Chip tone="ghost">linked</Chip>
                ) : (
                  <Chip tone="ghost" color={WARN}>
                    gap
                  </Chip>
                )}
              </Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
