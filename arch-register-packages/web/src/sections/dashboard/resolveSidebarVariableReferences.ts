/**
 * Substitutes `$<name>` references in a string with the dashboard sidebar's current selection
 * variables (see `dashboardSidebarConfigSchema.variableName` in `dashboardContract.ts`). A
 * reference to an unknown/unset variable is left as the literal `$<name>` rather than blanked,
 * so a widget config authored against a sidebar variable degrades visibly instead of silently.
 */
export const resolveSidebarVariableReferences = (
  input: string,
  variables: Record<string, string>
): string => input.replace(/\$(\w+)/g, (match, name: string) => variables[name] ?? match);

/**
 * Recursively applies `resolveSidebarVariableReferences` to every string value in a widget
 * config, so any config field — not just a single designated one — can reference a sidebar
 * variable (e.g. an entity id, but also a query string or a title).
 */
export const resolveConfigVariables = (
  config: Record<string, unknown>,
  variables: Record<string, string>
): Record<string, unknown> => resolveValue(config, variables) as Record<string, unknown>;

const resolveValue = (value: unknown, variables: Record<string, string>): unknown => {
  if (typeof value === 'string') return resolveSidebarVariableReferences(value, variables);
  if (Array.isArray(value)) return value.map(item => resolveValue(item, variables));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveValue(entryValue, variables)])
    );
  }
  return value;
};
