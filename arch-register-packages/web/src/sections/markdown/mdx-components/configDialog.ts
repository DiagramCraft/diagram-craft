import type { DashboardWidgetSpec } from './types';

const DEFAULT_CONFIG_DIALOG_WIDTH = 460;

/**
 * Width of the dialog hosting a component's config form. Declared once on the component's
 * dashboard registration and shared by the dashboard and wiki-editor dialogs.
 */
export const getConfigDialogWidth = (
  spec: Pick<DashboardWidgetSpec, 'dialogSize' | 'dialogWidth'> | undefined
): number | string => {
  if (spec?.dialogSize === 'large') return '90vw';
  return spec?.dialogWidth ?? DEFAULT_CONFIG_DIALOG_WIDTH;
};
