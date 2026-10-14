import type { TElement } from 'platejs';

export interface EntityActivityTrendChartSlateElement extends TElement {}

export type EntityActivityTrendChartProps = {
  /** Selects the 30-day or 90-day activity window shown by default. */
  lookbackDays?: number;
};
