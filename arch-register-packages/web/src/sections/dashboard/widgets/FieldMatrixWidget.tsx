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
  label?: string;
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
