import { useMemo } from 'react';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  hasWidgetRecordSource,
  useWidgetRecords,
  type WidgetRecordSource
} from '../../../hooks/useEntityQueryText';
import { Table } from '../../../components/table/Table';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatMeasured } from './fieldAggregation';
import { buildRollupRows } from './groupedRollupTableLogic';
import rowStyles from './WidgetRowList.module.css';
import styles from './GroupedRollupTableWidget.module.css';

export type GroupedRollupTableWidgetConfig = {
  /** Entity-query DSL text selecting the records to roll up. */
  query?: string;
  /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
  entityQuery?: EntityQuery;
  /** Root schema name `entityQuery`'s field names resolve against. */
  schemaName?: string;
  /** Field to group by. Blank lists one row per record. */
  groupFieldId?: string;
  /** Number or currency field summed per row. */
  valueFieldId: string;
  /** Column header for the group/name column. */
  groupLabel?: string;
  /** Column header for the value column. */
  valueLabel?: string;
  /** Draw each row's value relative to the largest row. */
  showBar?: boolean;
  /** Show each row's share of the total as a percentage. */
  showPercent?: boolean;
  /** Show how many records each row covers. */
  showCount?: boolean;
  /** Show a total row at the bottom. */
  showTotal?: boolean;
  limit?: number;
  label?: string;
};

export const isGroupedRollupTableConfigComplete = (
  config: GroupedRollupTableWidgetConfig
): boolean =>
  hasWidgetRecordSource(config as WidgetRecordSource) && config.valueFieldId.trim() !== '';

type Props = { config: GroupedRollupTableWidgetConfig };

/** Records summed into ranked rows - per record, or grouped by any field - with optional bar, share and count. */
export const GroupedRollupTableWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isGroupedRollupTableConfigComplete(config);
  const { data, isLoading } = useWidgetRecords(workspaceSlug, complete ? config : {});

  const result = useMemo(() => {
    const records = data?.entities ?? [];
    const schemaId = (records[0] as { _schemaId?: string } | undefined)?._schemaId;
    const groupField = schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === config.groupFieldId);
    const options =
      groupField && 'options' in groupField && Array.isArray(groupField.options)
        ? groupField.options
        : [];
    return buildRollupRows(records, {
      groupFieldId: config.groupFieldId || undefined,
      valueFieldId: config.valueFieldId,
      groupLabel: value =>
        options.find((option: { value: string; label: string }) => option.value === value)?.label ??
        value
    });
  }, [data, schemas, config.groupFieldId, config.valueFieldId]);

  if (!complete) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }
  const rows = result.rows.slice(0, config.limit ?? result.rows.length);
  const maxAmount = Math.max(...rows.map(row => row.amount), 0);
  const showBar = config.showBar ?? false;
  const columnCount =
    2 + (showBar ? 1 : 0) + (config.showPercent ? 1 : 0) + (config.showCount ? 1 : 0);

  return (
    <Table.Root scroll stickyHeader>
      <Table.Head>
        <Table.Row>
          <Table.HeaderCell>
            {config.groupLabel ?? (config.groupFieldId ? 'Group' : 'Name')}
          </Table.HeaderCell>
          {showBar && <Table.HeaderCell width={160}>Share</Table.HeaderCell>}
          <Table.HeaderCell numeric>{config.valueLabel ?? 'Total'}</Table.HeaderCell>
          {config.showPercent && <Table.HeaderCell numeric>%</Table.HeaderCell>}
          {config.showCount && <Table.HeaderCell numeric>Count</Table.HeaderCell>}
        </Table.Row>
      </Table.Head>
      <Table.Body>
        {rows.map(row => (
          <Table.Row
            key={row.key}
            onClick={row.entityPublicId ? () => openEntityDrawer(row.entityPublicId!) : undefined}
          >
            <Table.NameCell title={row.label} subtitle={row.entityPublicId} />
            {showBar && (
              <Table.Cell>
                <span className={styles.track} aria-hidden>
                  <span
                    className={styles.fill}
                    style={{
                      width: `${maxAmount > 0 ? Math.min(100, (Math.max(row.amount, 0) / maxAmount) * 100) : 0}%`
                    }}
                  />
                </span>
              </Table.Cell>
            )}
            <Table.Cell numeric>{formatMeasured(row.amount, row.currency)}</Table.Cell>
            {config.showPercent && (
              <Table.Cell numeric>
                <span className="dim mono tabular">
                  {result.totalAmount > 0
                    ? ((row.amount / result.totalAmount) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
              </Table.Cell>
            )}
            {config.showCount && <Table.Cell numeric>{row.count}</Table.Cell>}
          </Table.Row>
        ))}
        {(config.showTotal ?? true) && (
          <Table.Row>
            <Table.Cell>
              <strong>Total</strong>
            </Table.Cell>
            {showBar && <Table.Cell />}
            <Table.Cell numeric>
              <strong>{formatMeasured(result.totalAmount, result.totalCurrency)}</strong>
            </Table.Cell>
            {config.showPercent && <Table.Cell />}
            {config.showCount && (
              <Table.Cell numeric>
                <strong>{result.totalCount}</strong>
              </Table.Cell>
            )}
          </Table.Row>
        )}
        {rows.length === 0 && <Table.EmptyRow colSpan={columnCount}>No records.</Table.EmptyRow>}
      </Table.Body>
    </Table.Root>
  );
};
