import { useMemo } from 'react';
import { useWidgetRecords } from '../../../hooks/useEntityQueryText';
import { MatrixGrid } from '../../../components/MatrixGrid';
import { toneColor } from '../../../components/bandColor';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { buildFieldMatrixCells } from './fieldMatrixLogic';
import rowStyles from '../../shared/dashboard/WidgetRowList.module.css';
import { FieldMatrixWidgetConfig } from './types';

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
