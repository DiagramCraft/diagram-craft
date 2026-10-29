import type { TElement } from 'platejs';

export interface EntityLifecycleChartSlateElement extends TElement {}

/** No configuration yet; the chart always shows the workspace-wide lifecycle breakdown. */
export type EntityLifecycleChartProps = Record<string, never>;
