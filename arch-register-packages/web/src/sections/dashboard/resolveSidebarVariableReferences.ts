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
 *
 * A single array element that is a *whole* `$<name>` match (e.g. `{ op: 'in', value: ['$categoryIds'] }`)
 * is expanded into one array element per comma-separated id in that variable's value, rather than
 * substituted in place as one string — this is how a `facets`-kind sidebar's multi-select
 * (`variableName` holding a comma-joined id list) reaches an `in`-operator filter's array value.
 * A `$<name>` embedded inside a larger string, or used as a non-array/scalar config value (e.g. the
 * `entity-picker` kind's single selected id), is unaffected and still substitutes as plain text.
 */
export const resolveConfigVariables = (
  config: Record<string, unknown>,
  variables: Record<string, string>
): Record<string, unknown> => resolveValue(config, variables) as Record<string, unknown>;

const WHOLE_VARIABLE_REFERENCE = /^\$(\w+)$/;

const resolveValue = (value: unknown, variables: Record<string, string>): unknown => {
  if (typeof value === 'string') return resolveSidebarVariableReferences(value, variables);
  if (Array.isArray(value)) return value.flatMap(item => expandArrayItem(item, variables));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, resolveValue(entryValue, variables)])
    );
  }
  return value;
};

const expandArrayItem = (item: unknown, variables: Record<string, string>): unknown[] => {
  const name = typeof item === 'string' ? WHOLE_VARIABLE_REFERENCE.exec(item)?.[1] : undefined;
  const variableValue = name ? variables[name] : undefined;
  if (variableValue === undefined) return [resolveValue(item, variables)];
  return variableValue
    .split(',')
    .map((id: string) => id.trim())
    .filter((id: string) => id.length > 0);
};
