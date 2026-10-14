import { useMemo } from 'react';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import {
  hasWidgetRecordSource,
  useWidgetRecords,
  type WidgetRecordSource
} from '../../../hooks/useEntityQueryText';
import { MatrixGrid } from '../../../components/MatrixGrid';
import { toneColor } from '../../../components/bandColor';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { buildFieldMatrixCells, type FieldMatrixBand } from './fieldMatrixLogic';
import rowStyles from './WidgetRowList.module.css';
import { TbGrid4X4 } from 'react-icons/tb';
import type { DashboardWidgetRegistrationSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import configFormStyles from '../WidgetConfigDialog.module.css';

export type FieldMatrixWidgetConfig = {
  /** Entity-query DSL text selecting the records to place. */
  query?: string;
  /** Structured alternative to `query`; may reference dashboard sidebar `$variables`. */
  entityQuery?: EntityQuery;
  /** Root schema name `entityQuery`'s field names resolve against. */
  schemaName?: string;
  /** Numeric field whose value picks the row. */
  rowFieldId: string;
  /** Row values, in display order (top to bottom). */
  rows: number[];
  /** Numeric field whose value picks the column band. */
  valueFieldId: string;
  /** Column bands, ascending by `min`. */
  bands: FieldMatrixBand[];
  /** Emphasise cells in `hot` bands for rows at or above this value. */
  hotRowMin?: number;
  /** Corner label, e.g. "criticality ↓ / risk →". */
  cornerLabel?: string;
  /** Show the widget frame (border, title) around the matrix; defaults to true. */
  showFrame?: boolean;
};

export const isFieldMatrixConfigComplete = (config: FieldMatrixWidgetConfig): boolean =>
  hasWidgetRecordSource(config as WidgetRecordSource) &&
  config.rowFieldId.trim() !== '' &&
  config.valueFieldId.trim() !== '' &&
  config.rows.length > 0 &&
  config.bands.length > 0;

type Props = { config: FieldMatrixWidgetConfig };

/** Records placed in a `numeric row value × banded numeric value` grid, each cell listing clickable record chips. */
export const FieldMatrixWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const complete = isFieldMatrixConfigComplete(config);
  const { data, isLoading } = useWidgetRecords(workspaceSlug, complete ? config : {});

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

  if (!complete) {
    return (
      <div className={`${rowStyles.emptyInline} dim`}>This widget is not fully configured.</div>
    );
  }
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

export const FIELD_MATRIX_TYPE = 'FieldMatrix' as const;

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

const TONES = ['good', 'warn', 'bad', 'neutral'];

const isBand = (band: unknown): boolean => {
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

export const _fieldMatrixSpecData: Omit<
  DashboardWidgetRegistrationSpec<FieldMatrixWidgetConfig>,
  'label' | 'description'
> = {
  icon: TbGrid4X4,
  defaultW: 6,
  defaultH: 20,
  surfaces: ['workspace', 'project'],
  component: FieldMatrixWidget,
  frame: {
    hideOutsideEdit: config => config.showFrame === false,
    padded: false,
    showIcon: false
  },
  isValidConfig: (config): config is FieldMatrixWidgetConfig =>
    typeof config.rowFieldId === 'string' &&
    typeof config.valueFieldId === 'string' &&
    Array.isArray(config.rows) &&
    config.rows.every(row => typeof row === 'number') &&
    Array.isArray(config.bands) &&
    config.bands.every(isBand) &&
    optionalString(config.query) &&
    optionalString(config.schemaName) &&
    optionalString(config.cornerLabel) &&
    (config.showFrame === undefined || typeof config.showFrame === 'boolean') &&
    (config.hotRowMin === undefined || typeof config.hotRowMin === 'number') &&
    isFieldMatrixConfigComplete(config as FieldMatrixWidgetConfig),
  createDefaultProps: () => ({
    config: {
      query: '',
      rowFieldId: '',
      rows: [3, 2, 1],
      valueFieldId: '',
      bands: [
        { label: 'Low', min: 0, tone: 'good' },
        { label: 'High', min: 3, tone: 'bad' }
      ]
    }
  }),
  configForm: FieldMatrixConfigForm
};
