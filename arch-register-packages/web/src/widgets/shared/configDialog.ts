import type { ConfigDialogSpec } from './types';

const DEFAULT_CONFIG_DIALOG_WIDTH = 460;

/** Width of the dialog hosting a component's config form, in the wiki editor and on a dashboard. */
export const getConfigDialogWidth = (spec: ConfigDialogSpec | undefined): number | string => {
  if (spec?.size === 'large') return '90vw';
  return spec?.width ?? DEFAULT_CONFIG_DIALOG_WIDTH;
};
