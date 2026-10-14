import { useMemo } from 'react';
import { hasWidgetRecordSource, useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { Table } from '../../../components/table/Table';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { formatMeasured } from './fieldAggregation';
import { buildRollupRows } from './groupedRollupTableLogic';
import rowStyles from './WidgetRowList.module.css';
import styles from './GroupedRollupTableWidget.module.css';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const groupedRollupTableWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to roll up. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /** Field to group by. Blank lists one row per record. */
    groupFieldId: z.string().optional(),
    /** Number or currency field summed per row. */
    valueFieldId: withInitial(z.string().trim().min(1), ''),
    /** Column header for the group/name column. */
    groupLabel: z.string().optional(),
    /** Column header for the value column. */
    valueLabel: z.string().optional(),
    /** Draw each row's value relative to the largest row. */
    showBar: z.boolean().optional(),
    /** Show each row's share of the total as a percentage. */
    showPercent: z.boolean().optional(),
    /** Show how many records each row covers. */
    showCount: z.boolean().optional(),
    /** Show a total row at the bottom. */
    showTotal: z.boolean().optional(),
    limit: z.number().positive().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type GroupedRollupTableWidgetConfig = z.infer<typeof groupedRollupTableWidgetConfigSchema>;

type Props = { config: GroupedRollupTableWidgetConfig };

/** Records summed into ranked rows - per record, or grouped by any field - with optional bar, share and count. */
export const GroupedRollupTableWidget = ({ config }: Props) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const { data, isLoading } = useWidgetRecords(workspaceSlug, config);

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

type GroupedRollupTableConfigFormProps = {
  config: GroupedRollupTableWidgetConfig;
  onChange: (config: GroupedRollupTableWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const Toggle = ({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <label className={configFormStyles.optionRow}>
    <span className={configFormStyles.optionLabel}>{label}</span>
    <div className={configFormStyles.optionControl}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
    </div>
  </label>
);

export const GroupedRollupTableConfigForm = ({
  config,
  onChange
}: GroupedRollupTableConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query ?? ''}
        placeholder='e.g. schema:"Vendor"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Sum field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.valueFieldId}
        placeholder="e.g. spend"
        onChange={e => onChange({ ...config, valueFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Group by field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.groupFieldId ?? ''}
              placeholder="Blank = one row per record"
              onChange={e => onChange({ ...config, groupFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Group column title</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.groupLabel ?? ''}
              placeholder="Name"
              onChange={e => onChange({ ...config, groupLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Value column title</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.valueLabel ?? ''}
              placeholder="Total"
              onChange={e => onChange({ ...config, valueLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <Toggle
          label="Bars"
          checked={config.showBar ?? false}
          onChange={checked => onChange({ ...config, showBar: checked || undefined })}
        />
        <Toggle
          label="Share %"
          checked={config.showPercent ?? false}
          onChange={checked => onChange({ ...config, showPercent: checked || undefined })}
        />
        <Toggle
          label="Record count"
          checked={config.showCount ?? false}
          onChange={checked => onChange({ ...config, showCount: checked || undefined })}
        />
        <Toggle
          label="Total row"
          checked={config.showTotal ?? true}
          onChange={checked => onChange({ ...config, showTotal: checked ? undefined : false })}
        />
      </div>
    </DialogSection>
  </>
);
