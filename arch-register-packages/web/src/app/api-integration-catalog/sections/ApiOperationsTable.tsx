import { useMemo } from 'react';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { useTableSort } from '../../../components/table/useTableSort';
import type { ApiOperationRow } from '../useApiOperationsFeed';

type SortKey = 'method' | 'path' | 'api';

// Method → color, mirroring the Claude Design reference's `IC_METHOD_TONE` (`ic-data.jsx`) —
// GET-like (read) methods read as safe/positive, write methods as accent, PATCH/PUT as a caution,
// DELETE as the one destructive method — mapped onto this app's existing `--cmp-fg-*` chip-color
// tokens (already used this way by `ApiIntegrationCatalogIntegrationsScreen.tsx`'s DANGER/WARN
// constants) rather than the design's own ad hoc CSS variables. Anything else (RPC, PUBLISH,
// SOAP, …) gets no explicit color — `Chip`'s default `ghost` tone still gives it a plain border.
const METHOD_TONE: Record<string, string> = {
  GET: 'var(--cmp-fg-success, #22c55e)',
  QUERY: 'var(--cmp-fg-success, #22c55e)',
  POST: 'var(--accent-fg)',
  MUTATION: 'var(--accent-fg)',
  PATCH: 'var(--cmp-fg-warning, #eab308)',
  PUT: 'var(--cmp-fg-warning, #eab308)',
  DELETE: 'var(--cmp-fg-danger, #ef4444)'
};

/**
 * A flat, sortable table of operations/messages across every API in scope — backs the APIs
 * section's "Operations" sub-view (#3345), the caller (`ApiIntegrationCatalogApisScreen.tsx`)
 * supplying already-filtered rows (`useApiOperationsFeed`) and an `emptyLabel` — mirrors
 * `ApiPairsTable.tsx`'s role as a section-local flat sub-table.
 */
export const ApiOperationsTable = ({
  rows,
  isLoading,
  q,
  emptyLabel,
  onOpenApi
}: {
  rows: ApiOperationRow[];
  isLoading: boolean;
  q: string;
  emptyLabel: string;
  onOpenApi: (apiPublicId: string) => void;
}) => {
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(row =>
      [row.item.action, row.item.path, row.item.channel, row.api.name, ...row.item.tags]
        .filter((value): value is string => typeof value === 'string')
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [rows, q]);

  const { sorted, sort, toggleSort } = useTableSort<ApiOperationRow, SortKey>(
    filtered,
    {
      method: (a, b) => a.item.action.localeCompare(b.item.action),
      path: (a, b) =>
        (a.item.path ?? a.item.channel ?? '').localeCompare(b.item.path ?? b.item.channel ?? ''),
      api: (a, b) => a.api.name.localeCompare(b.api.name)
    },
    { key: 'api', dir: 'asc' }
  );

  return (
    <Table.Root scroll stickyHeader>
      <Table.Head>
        <Table.Row>
          <Table.SortableHeaderCell sortKey="method" sort={sort} onSort={toggleSort}>
            Method
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="path" sort={sort} onSort={toggleSort}>
            Path
          </Table.SortableHeaderCell>
          <Table.SortableHeaderCell sortKey="api" sort={sort} onSort={toggleSort}>
            API
          </Table.SortableHeaderCell>
          <Table.HeaderCell>Deprecated</Table.HeaderCell>
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {sorted.length === 0 ? (
          <Table.EmptyRow colSpan={4}>
            {isLoading ? 'Loading operations…' : emptyLabel}
          </Table.EmptyRow>
        ) : (
          sorted.map(row => (
            <Table.Row key={row.key} onClick={() => onOpenApi(row.api.publicId)}>
              <Table.Cell>
                <Chip tone="ghost" color={METHOD_TONE[row.item.action.toUpperCase()]}>
                  {row.item.action.toUpperCase()}
                </Chip>
              </Table.Cell>
              <Table.NameCell
                title={row.item.path ?? row.item.channel ?? 'Unspecified resource'}
                subtitle={row.item.identifier}
              />
              <Table.Cell className="dim">{row.api.name}</Table.Cell>
              <Table.Cell>{row.item.deprecated && <Chip tone="ghost">Deprecated</Chip>}</Table.Cell>
            </Table.Row>
          ))
        )}
      </Table.Body>
    </Table.Root>
  );
};
