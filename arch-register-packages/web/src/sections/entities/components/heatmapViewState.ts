import type { EntityRecord } from '@arch-register/api-types/entityContract';
import { getCategoricalValue, getNumericValue, type FieldOption } from './entityFieldSources';

export type HeatmapConfig = {
  likelihoodFieldId: string;
  impactFieldId: string;
  buckets: number;
  colorFieldId: string | null;
};

export type HeatmapBucket = { id: string; label: string };

export type HeatmapCell = {
  row: number;
  col: number;
  count: number;
  entityIds: string[];
  colorValue: number | null;
};

/**
 * Buckets for one axis: a select field contributes one bucket per declared option (in
 * declaration order), a numeric field is split into `bucketCount` equal-width bands across
 * `range`. Mirrors how BubbleView's `positionOnBubbleAxis` treats categorical vs. numeric axes.
 */
export const buildAxisBuckets = (
  categories: FieldOption[] | null,
  range: { min: number; max: number } | null,
  bucketCount: number
): HeatmapBucket[] => {
  if (categories) return categories;
  if (!range) return [];
  const width = (range.max - range.min) / bucketCount;
  return Array.from({ length: bucketCount }, (_, i) => {
    const lo = range.min + i * width;
    const hi = range.min + (i + 1) * width;
    return { id: `band-${i}`, label: `${formatBand(lo)}–${formatBand(hi)}` };
  });
};

const formatBand = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1));

/**
 * Index of the bucket an entity's axis value falls into, or null when the value is missing
 * or unmappable (categorical value not among the axis's declared options).
 */
export const bucketIndexForEntity = (
  entity: EntityRecord,
  fieldId: string,
  categories: FieldOption[] | null,
  range: { min: number; max: number } | null,
  bucketCount: number
): number | null => {
  if (categories) {
    const value = getCategoricalValue(entity, fieldId);
    if (value == null) return null;
    const index = categories.findIndex(category => category.id === value);
    return index === -1 ? null : index;
  }
  if (!range) return null;
  const value = getNumericValue(entity, fieldId);
  if (value == null) return null;
  if (range.max === range.min) return Math.floor(bucketCount / 2);
  const normalized = (value - range.min) / (range.max - range.min);
  const clamped = Math.min(1, Math.max(0, normalized));
  return Math.min(bucketCount - 1, Math.floor(clamped * bucketCount));
};

type BuildHeatmapCellsOptions = {
  entities: EntityRecord[];
  config: HeatmapConfig;
  likelihoodBuckets: HeatmapBucket[];
  impactBuckets: HeatmapBucket[];
  likelihoodCategories: FieldOption[] | null;
  impactCategories: FieldOption[] | null;
  likelihoodRange: { min: number; max: number } | null;
  impactRange: { min: number; max: number } | null;
};

/**
 * Dense row x col grid (rows = likelihood buckets, cols = impact buckets), every cell present
 * even when empty so the UI can render a complete NxN grid. Entities whose likelihood or
 * impact value doesn't map to any bucket are excluded from the grid and counted separately.
 */
export const buildHeatmapCells = ({
  entities,
  config,
  likelihoodBuckets,
  impactBuckets,
  likelihoodCategories,
  impactCategories,
  likelihoodRange,
  impactRange
}: BuildHeatmapCellsOptions): { cells: HeatmapCell[][]; unmappedCount: number } => {
  const cells: HeatmapCell[][] = likelihoodBuckets.map((_, row) =>
    impactBuckets.map((_, col) => ({ row, col, count: 0, entityIds: [], colorValue: null }))
  );
  const colorSums: number[][] = likelihoodBuckets.map(() => impactBuckets.map(() => 0));
  const colorCounts: number[][] = likelihoodBuckets.map(() => impactBuckets.map(() => 0));

  let unmappedCount = 0;
  for (const entity of entities) {
    const row = bucketIndexForEntity(
      entity,
      config.likelihoodFieldId,
      likelihoodCategories,
      likelihoodRange,
      likelihoodBuckets.length
    );
    const col = bucketIndexForEntity(
      entity,
      config.impactFieldId,
      impactCategories,
      impactRange,
      impactBuckets.length
    );
    if (row == null || col == null) {
      unmappedCount += 1;
      continue;
    }
    const cell = cells[row]![col]!;
    cell.count += 1;
    cell.entityIds.push(entity._uid);

    if (config.colorFieldId) {
      const colorValue = getNumericValue(entity, config.colorFieldId);
      if (colorValue != null) {
        colorSums[row]![col]! += colorValue;
        colorCounts[row]![col]! += 1;
      }
    }
  }

  if (config.colorFieldId) {
    cells.forEach((rowCells, row) =>
      rowCells.forEach((cell, col) => {
        const count = colorCounts[row]![col]!;
        cell.colorValue = count > 0 ? colorSums[row]![col]! / count : null;
      })
    );
  }

  return { cells, unmappedCount };
};

// Fixed status-severity ramp (good -> warning -> serious -> critical), the validated default
// palette's status colors. Interpolated across grid position rather than cycled/reassigned, so
// the same (row, col) always reads the same severity regardless of axis bucket counts.
const SEVERITY_STOPS: readonly [number, number, number][] = [
  [0x0c, 0xa3, 0x0c], // good
  [0xfa, 0xb2, 0x19], // warning
  [0xec, 0x83, 0x5a], // serious
  [0xd0, 0x3b, 0x3b] // critical
];

const toHex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

const interpolateSeverity = (t: number): string => {
  const clamped = Math.min(1, Math.max(0, t));
  const scaled = clamped * (SEVERITY_STOPS.length - 1);
  const index = Math.min(SEVERITY_STOPS.length - 2, Math.floor(scaled));
  const localT = scaled - index;
  const [r0, g0, b0] = SEVERITY_STOPS[index]!;
  const [r1, g1, b1] = SEVERITY_STOPS[index + 1]!;
  const r = r0 + (r1 - r0) * localT;
  const g = g0 + (g1 - g0) * localT;
  const b = b0 + (b1 - b0) * localT;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

/** Default cell colour: severity by grid position (low likelihood+impact = good, both high = critical). */
export const severityColorForCell = (row: number, col: number, rowCount: number, colCount: number): string => {
  const maxPosition = rowCount - 1 + (colCount - 1);
  if (maxPosition <= 0) return interpolateSeverity(0.5);
  return interpolateSeverity((row + col) / maxPosition);
};

/** Colour for a cell driven by an averaged numeric field instead of grid position. */
export const severityColorForValue = (value: number, min: number, max: number): string => {
  if (min === max) return interpolateSeverity(0.5);
  return interpolateSeverity((value - min) / (max - min));
};
