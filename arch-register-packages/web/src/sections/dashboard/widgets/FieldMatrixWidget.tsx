import { useMemo } from 'react';
import { hasWidgetRecordSource, useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { MatrixGrid } from '../../../components/MatrixGrid';
import { toneColor } from '../../../components/bandColor';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { buildFieldMatrixCells, fieldMatrixBandSchema } from './fieldMatrixLogic';
import rowStyles from './WidgetRowList.module.css';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';
import { z } from 'zod';
import { entityQuerySchema } from '@arch-register/api-types/entityQueryIR';
import { withInitial } from '../../markdown/mdx-components/configSchema';

export const fieldMatrixWidgetConfigSchema = z
  .object({
    /** Entity-query DSL text selecting the records to place. */
    query: withInitial(z.string().optional(), ''),
    /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
    entityQuery: entityQuerySchema.optional(),
    /** Root schema name `entityQuery`'s field names resolve against. */
    schemaName: z.string().optional(),
    /** Numeric field whose value picks the row. */
    rowFieldId: withInitial(z.string().trim().min(1), ''),
    /** Row values, in display order (top to bottom). */
    rows: withInitial(z.array(z.number()).min(1), [3, 2, 1]),
    /** Numeric field whose value picks the column band. */
    valueFieldId: withInitial(z.string().trim().min(1), ''),
    /** Column bands, ascending by `min`. */
    bands: withInitial(z.array(fieldMatrixBandSchema).min(1), [
      { label: 'Low', min: 0, tone: 'good' },
      { label: 'High', min: 3, tone: 'bad' }
    ]),
    /** Emphasise cells in `hot` bands for rows at or above this value. */
    hotRowMin: z.number().optional(),
    /** Corner label, e.g. "criticality ↓ / risk →". */
    cornerLabel: z.string().optional(),
    /** Show the widget frame (border, title) around the matrix; defaults to true. */
    showFrame: z.boolean().optional()
  })
  .refine(hasWidgetRecordSource, { message: 'Needs a query or an entity query' });

export type FieldMatrixWidgetConfig = z.infer<typeof fieldMatrixWidgetConfigSchema>;

type Props = { config: FieldMatrixWidgetConfig };

/** Records placed in a `numeric row value × banded numeric value` grid, each cell listing clickable record chips. */
export const FieldMatrixWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const { data, isLoading } = useWidgetRecords(workspaceSlug, config);

  const cells = useMemo(
    () =>
      buildFieldMatrixCells(data?.entities ?? [], {
        rowFieldId: config.rowFieldId,
        valueFieldId: config.valueFieldId,
        rows: config.rows,
        bands: config.bands
      }),
    [data, config.rowFieldId, config.valueFieldId, config.rows, config.bands]
  );

  if (isLoading) return <div className={`${rowStyles.emptyInline} dim`}>Loading…</div>;
  if (data?.ok === false) {
    return <div className={`${rowStyles.emptyInline} dim`}>This widget's query is not valid.</div>;
  }

  return (
    <MatrixGrid
      cornerLabel={config.cornerLabel ?? ''}
      columns={config.bands.map((band, index) => ({ key: index, label: band.label }))}
      rows={config.rows.map(row => ({ key: row, label: row }))}
      cells={cells}
      getCellStyle={(row, column) => {
        const band = config.bands[Number(column)]!;
        return {
          color: toneColor(band.tone),
          emphasized:
            !!band.hot && config.hotRowMin !== undefined && Number(row) >= config.hotRowMin
        };
      }}
      onOpenItem={openEntityDrawer}
      rowHeaderWidth={64}
      cellAspect={false}
    />
  );
};

type FieldMatrixConfigFormProps = {
  config: FieldMatrixWidgetConfig;
  onChange: (config: FieldMatrixWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const parseRows = (text: string): number[] =>
  text
    .split(',')
    .filter(part => part.trim() !== '')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value));

export const FieldMatrixConfigForm = ({ config, onChange }: FieldMatrixConfigFormProps) => (
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
    <DialogSection label="Row field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.rowFieldId}
        placeholder="e.g. criticality"
        onChange={e => onChange({ ...config, rowFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Row values, top to bottom" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        defaultValue={config.rows.join(', ')}
        placeholder="e.g. 5, 4, 3, 2"
        onBlur={e => onChange({ ...config, rows: parseRows(e.target.value) })}
      />
    </DialogSection>
    <DialogSection label="Column field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.valueFieldId}
        placeholder="e.g. risk"
        onChange={e => onChange({ ...config, valueFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Corner label</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.cornerLabel ?? ''}
              onChange={e => onChange({ ...config, cornerLabel: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Emphasise hot bands from row</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              className={configFormStyles.labelInput}
              value={config.hotRowMin ?? ''}
              onChange={e =>
                onChange({
                  ...config,
                  hotRowMin: e.target.value === '' ? undefined : Number(e.target.value)
                })
              }
            />
          </div>
        </label>
      </div>
    </DialogSection>
    <DialogSection label="Bands (JSON: label, min, tone, hot)" required>
      <textarea
        className={configFormStyles.labelInput}
        rows={6}
        defaultValue={JSON.stringify(config.bands, null, 2)}
        onBlur={e => {
          try {
            const parsed = JSON.parse(e.target.value);
            if (Array.isArray(parsed)) onChange({ ...config, bands: parsed });
          } catch {
            // Keep the previous bands until the text is valid JSON.
          }
        }}
      />
    </DialogSection>
  </>
);

const TONES = ['good', 'warn', 'bad', 'neutral'];

export const isBand = (band: unknown): boolean => {
  const value = band as Record<string, unknown> | null;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.label === 'string' &&
    typeof value.min === 'number' &&
    typeof value.tone === 'string' &&
    TONES.includes(value.tone) &&
    (value.hot === undefined || typeof value.hot === 'boolean')
  );
};
