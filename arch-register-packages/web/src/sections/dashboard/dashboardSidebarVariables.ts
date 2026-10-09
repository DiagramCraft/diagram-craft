import type { DashboardSidebarConfig } from '@arch-register/api-types/dashboardContract';
import type { DashboardSidebarVariables } from './DashboardSidebarContext';

/**
 * Derives the `$<variableName>` substitution values (`resolveSidebarVariableReferences.ts`) a
 * dashboard's sidebar selection exposes to its widgets, from the current route search params.
 *
 * `entity-picker` (single-select) leaves an unselected variable absent, so its `$variableName`
 * placeholder stays literal (visibly "nothing picked") rather than resolving to an empty string.
 *
 * `options` (fixed single-select) resolves an unselected variable to an empty string rather than
 * leaving the placeholder literal: its consumers (e.g. a status filter) treat '' as "no filter".
 *
 * `facets` (multi-select) must instead resolve an unselected variable to an explicit empty string:
 * `resolveConfigVariables`'s whole-match array expansion turns `''` into `[]`, which
 * `stripEmptyGroups` then drops as "no filter" (`entityBrowserState.ts`). Leaving the variable
 * absent instead would keep a widget's `$variableName` placeholder literal, producing an
 * `in [...]` filter that matches nothing and empties the widget whenever no facet is selected.
 */
/**
 * TanStack parses numeric-looking search values (e.g. a `valueKind: 'id'` picker value) into
 * numbers; sidebar variables are always strings.
 */
const searchString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : undefined;

export const computeSidebarVariables = (
  sidebar: DashboardSidebarConfig | undefined,
  search: Record<string, unknown>
): DashboardSidebarVariables => {
  if (!sidebar) return {};
  const variables: DashboardSidebarVariables = {};
  if (sidebar.kind === 'entity-picker') {
    const value = searchString(search[sidebar.variableName]);
    if (value !== undefined) variables[sidebar.variableName] = value;
    return variables;
  }
  if (sidebar.kind === 'options') {
    variables[sidebar.variableName] = searchString(search[sidebar.variableName]) ?? '';
    return variables;
  }
  for (const facet of sidebar.facets) {
    variables[facet.variableName] = searchString(search[facet.variableName]) ?? '';
  }
  return variables;
};
