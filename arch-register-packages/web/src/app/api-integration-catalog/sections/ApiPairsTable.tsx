import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import type { ApiPair } from '../apiPairCoverage';

type SortKey = 'consumer';

// Duplicated from `ApiIntegrationCatalogIntegrationsScreen.tsx`'s own `WARN` const rather than
// imported, to avoid a circular import between the screen and this sub-table.
const WARN = 'var(--cmp-fg-warning, #eab308)';

/**
 * Every `Provides API` × `Consumes API` pairing for each registered API — Consumer, API, Provider —
 * independent of whether a Data Flow relation exists for it, with a column flagging whether one
 * does (#3340). Deliberately lighter than the Data Flow table above: no owner/classification/
 * carried-data/boundary columns, since those governance fields only exist on Data Flow relations.
 * Rows are non-interactive in this iteration — neither the shared API `EntityDrawer` (API-scoped) nor
 * `IntegrationDrawer` (expects Data Flow governance fields) fits a 3-entity pair without a new
 * drawer, deferred as a possible follow-up.
 */
export const ApiPairsTable = ({ pairs, q }: { pairs: ApiPair[]; q: string }) => {
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return pairs;
    return pairs.filter(pair =>
      [pair.consumer.name, pair.api.name, pair.provider.name]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [pairs, q]);

  const { sorted, sort, toggleSort } = useTableSort<ApiPair, SortKey>(
    filtered,
    { consumer: (a, b) => a.consumer.name.localeCompare(b.consumer.name) },
    { key: 'consumer', dir: 'asc' }
  );

  return (
    <Table.Root scroll stickyHeader>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="consumer" sort={sort} onSort={toggleSort}>
            Consumer
          </Table.SortableHeaderCell>
          <Table.HeaderCell>API</Table.HeaderCell>
          <Table.HeaderCell>Provider</Table.HeaderCell>
          <Table.HeaderCell>Data Flow</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={4}>
            {pairs.length === 0
              ? 'No API is both provided and consumed.'
              : 'No pairs match this search.'}
          </Table.EmptyRow>
        ) : (
          sorted.map(pair => (
            <Table.Row key={pair.key}>
              <Table.NameCell title={pair.consumer.name} />
              <Table.Cell className="dim">{pair.api.name}</Table.Cell>
              <Table.Cell className="dim">{pair.provider.name}</Table.Cell>
              <Table.Cell>
                {!pair.dataFlowApplicable ? (
                  <span className="dim">n/a (component)</span>
                ) : pair.hasDataFlow ? (
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
