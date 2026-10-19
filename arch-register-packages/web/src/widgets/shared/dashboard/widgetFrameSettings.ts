import type { DashboardWidgetFrame } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../types';

export type ResolvedWidgetFrame = {
  /** Title override; undefined means use the widget's own title */
  title: string | undefined;
  /** Icon name override; undefined means use the spec icon */
  iconName: string | undefined;
  showIcon: boolean;
  /** Whether the frame (border + header) is shown outside edit mode */
  showFrame: boolean;
  padded: boolean;
};

/** Frame visibility a widget has when the instance does not override it. */
export const DEFAULT_SHOW_FRAME = true;

/** Combines per-instance overrides with the defaults declared by the widget spec. */
export const resolveWidgetFrame = (
  spec: DashboardWidgetSpec | undefined,
  frame: DashboardWidgetFrame | undefined
): ResolvedWidgetFrame => ({
  title: frame?.title?.trim() ? frame.title : undefined,
  iconName: frame?.icon,
  showIcon: frame?.icon !== undefined || spec?.frame?.showIcon !== false,
  showFrame: frame?.showFrame ?? DEFAULT_SHOW_FRAME,
  padded: spec?.frame?.padded !== false
});

/** Drops empty values so unmodified widgets keep serializing without a `frame` key. */
export const normalizeFrame = (frame: DashboardWidgetFrame): DashboardWidgetFrame | undefined => {
  const result: DashboardWidgetFrame = {};
  if (frame.title?.trim()) result.title = frame.title;
  if (frame.showFrame !== undefined) result.showFrame = frame.showFrame;
  if (frame.icon !== undefined) result.icon = frame.icon;
  return Object.keys(result).length > 0 ? result : undefined;
};
