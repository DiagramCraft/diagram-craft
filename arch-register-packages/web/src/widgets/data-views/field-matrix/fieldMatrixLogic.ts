import { z } from 'zod';
import type { MatrixGridItem } from '../../../components/MatrixGrid';
import { matrixCellKey } from '../../../components/MatrixGrid';
import type { ToneOrNeutral } from '../../../components/bandColor';

export const fieldMatrixBandSchema = z.object({
  label: z.string(),
  /** Lower bound (inclusive) of the band; a record falls in the last band whose `min` it meets. */
  min: z.number(),
  tone: z.enum(['good', 'warn', 'bad', 'neutral']) satisfies z.ZodType<ToneOrNeutral>,
  /** Cells in this band are emphasised for rows at or above `hotRowMin`. */
  hot: z.boolean().optional()
});

export type FieldMatrixBand = z.infer<typeof fieldMatrixBandSchema>;

type MatrixRecord = {
  _publicId: string;
  _name: string;
  [fieldId: string]: unknown;
};

/** Index of the band `value` falls in, or null when below every band / not a finite number. */
export const bandIndexFor = (value: unknown, bands: readonly FieldMatrixBand[]): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  let result: number | null = null;
  bands.forEach((band, index) => {
    if (value >= band.min && (result === null || band.min >= bands[result]!.min)) result = index;
  });
  return result;
};

/** Buckets records into `row value × band` cells; records outside the configured rows are skipped. */
export const buildFieldMatrixCells = (
  records: readonly MatrixRecord[],
  options: {
    rowFieldId: string;
    valueFieldId: string;
    rows: readonly number[];
    bands: readonly FieldMatrixBand[];
  }
): Map<string, MatrixGridItem[]> => {
  const cells = new Map<string, MatrixGridItem[]>();
  for (const record of records) {
    const rowValue = record[options.rowFieldId];
    if (typeof rowValue !== 'number' || !options.rows.includes(rowValue)) continue;
    const bandIndex = bandIndexFor(record[options.valueFieldId], options.bands);
    if (bandIndex === null) continue;
    const key = matrixCellKey(rowValue, bandIndex);
    const list = cells.get(key) ?? [];
    list.push({ id: record._publicId, label: record._name });
    cells.set(key, list);
  }
  return cells;
};
