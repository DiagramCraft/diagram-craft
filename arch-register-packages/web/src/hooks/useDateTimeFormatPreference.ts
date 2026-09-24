import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { DEFAULT_DATE_TIME_FORMAT_PREFERENCE, type DateTimeFormatPreference } from '../utils/dateFormat';

/**
 * Resolves the current workspace's configured date/time display preference,
 * falling back to the default (iso/24h) while the workspace hasn't loaded yet.
 */
export const useDateTimeFormatPreference = (): DateTimeFormatPreference => {
  const context = useWorkspaceContext();
  const workspace = context?.workspace;
  if (!workspace) return DEFAULT_DATE_TIME_FORMAT_PREFERENCE;
  return { date_format: workspace.date_format, time_format: workspace.time_format };
};
