import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../types';

export type WidgetFrameStyle = NonNullable<DashboardWidgetFrame['style']>;
export type WidgetTint = NonNullable<DashboardWidgetFrame['tint']>;

export const WIDGET_FRAME_STYLES: { value: WidgetFrameStyle; label: string }[] = [
  { value: 'header', label: 'With header' },
  { value: 'frame', label: 'With frame' },
  { value: 'none', label: 'No frame' }
];

export const WIDGET_TINTS: WidgetTint[] = ['gray', 'blue', 'green', 'amber', 'red', 'purple'];

export type ResolvedWidgetFrame = {
  /** Title override; undefined means use the widget's own title */
  title: string | undefined;
  /** Icon name override; undefined means use the spec icon */
  iconName: string | undefined;
  showIcon: boolean;
  /** How much of the frame (border, header) is shown outside edit mode */
  style: WidgetFrameStyle;
  tint: WidgetTint | undefined;
  padded: boolean;
};

/** Frame style a widget has when the instance does not override it. */
export const DEFAULT_FRAME_STYLE: WidgetFrameStyle = 'header';

/** Maps the deprecated boolean `showFrame` onto a frame style. */
const legacyStyle = (showFrame: boolean | undefined): WidgetFrameStyle | undefined =>
  showFrame === undefined ? undefined : showFrame ? 'header' : 'none';

export const resolveFrameStyle = (frame: DashboardWidgetFrame | undefined): WidgetFrameStyle =>
  frame?.style ?? legacyStyle(frame?.showFrame) ?? DEFAULT_FRAME_STYLE;

/** Combines per-instance overrides with the defaults declared by the widget spec. */
export const resolveWidgetFrame = (
  spec: DashboardWidgetSpec | undefined,
  frame: DashboardWidgetFrame | undefined
): ResolvedWidgetFrame => ({
  title: frame?.title?.trim() ? frame.title : undefined,
  iconName: frame?.icon,
  showIcon: frame?.icon !== undefined || spec?.frame?.showIcon !== false,
  style: resolveFrameStyle(frame),
  tint: frame?.tint,
  padded: spec?.frame?.padded !== false
});

/**
 * Drops empty values so unmodified widgets keep serializing without a `frame` key, and migrates
 * the deprecated `showFrame` to `style`.
 */
export const normalizeFrame = (frame: DashboardWidgetFrame): DashboardWidgetFrame | undefined => {
  const result: DashboardWidgetFrame = {};
  if (frame.title?.trim()) result.title = frame.title;
  const style = frame.style ?? legacyStyle(frame.showFrame);
  if (style !== undefined) result.style = style;
  if (frame.tint !== undefined) result.tint = frame.tint;
  if (frame.icon !== undefined) result.icon = frame.icon;
  return Object.keys(result).length > 0 ? result : undefined;
};
