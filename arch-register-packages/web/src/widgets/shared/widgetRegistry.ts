import type {
  WidgetDefinition,
  DashboardWidgetWidgetDefinition,
  DefaultConfigContext,
  MdxWidgetDefinition
} from './types';
import { initialConfigOf } from './configSchema';

/** Registrations by type, in registration order. */
const definitionsByType = new Map<string, WidgetDefinition>();

/** Narrows component definitions to registrations that provide this surface. */
export type WidgetDefinitionFilter = 'mdx' | 'dashboard';

type WidgetDefinitionFor<Filter extends WidgetDefinitionFilter | undefined> =
  Filter extends 'mdx'
    ? MdxWidgetDefinition
    : Filter extends 'dashboard'
      ? DashboardWidgetWidgetDefinition
      : WidgetDefinition;

/**
 * `defineWidget` guarantees that a dashboard widget has an icon, a config schema and so a
 * default config, so the presence of the spec is all that needs checking.
 */
const provides = (definition: WidgetDefinition, filter: WidgetDefinitionFilter): boolean =>
  (filter === 'mdx' ? definition.mdx : definition.dashboard) !== undefined;

/** Return all registrations, or narrow them to definitions with the selected spec. */
export const getWidgetDefinitions = <
  Filter extends WidgetDefinitionFilter | undefined = undefined
>(
  filter?: Filter
): ReadonlyArray<WidgetDefinitionFor<Filter>> => {
  const all = [...definitionsByType.values()];
  const matching = filter ? all.filter(definition => provides(definition, filter)) : all;
  return matching as unknown as ReadonlyArray<WidgetDefinitionFor<Filter>>;
};

/** Look up a registration by id, optionally requiring a particular spec. */
export const getWidgetDefinition = <
  Filter extends WidgetDefinitionFilter | undefined = undefined
>(
  id: string,
  filter?: Filter
): WidgetDefinitionFor<Filter> | undefined => {
  const definition = definitionsByType.get(id);
  if (!definition || (filter && !provides(definition, filter))) return undefined;
  return definition as WidgetDefinitionFor<Filter>;
};

/** Add component registrations; a type may only be registered once. */
export const registerWidgetDefinitions = (
  definitions: ReadonlyArray<WidgetDefinition>
): void => {
  for (const definition of definitions) {
    if (definitionsByType.has(definition.type)) {
      throw new Error(`Duplicate component registration for "${definition.type}"`);
    }
    definitionsByType.set(definition.type, definition);
  }
};

let wikiMdxComponents: Record<string, MdxWidgetDefinition> | undefined;

/**
 * The MDX components that may appear in wiki content. The wiki parser and renderer must use this
 * rather than the whole registry, so dashboard-only widgets are never recognized there even if
 * stored content names one. Resolved once, after registration has completed.
 */
export const getWikiMdxComponents = (): Record<string, MdxWidgetDefinition> => {
  wikiMdxComponents ??= Object.fromEntries(
    getWidgetDefinitions('mdx').map(definition => [definition.type, definition])
  );
  return wikiMdxComponents;
};

/**
 * Whether `config` is a valid (and complete) config for the component. Components without a
 * `configSchema` accept anything.
 */
export const isValidComponentConfig = (
  definition: Pick<WidgetDefinition, 'configSchema'> | undefined,
  config: Record<string, unknown>
): boolean => definition?.configSchema?.safeParse(config).success ?? true;

/**
 * The complete starting config of a new instance: the values declared on the schema, with the
 * context-dependent `defaultConfig` over them.
 */
export const createDefaultConfig = (
  definition: Pick<WidgetDefinition, 'configSchema' | 'defaultConfig'>,
  context: DefaultConfigContext
): Record<string, unknown> => ({
  ...(definition.configSchema ? initialConfigOf(definition.configSchema) : {}),
  ...definition.defaultConfig?.(context)
});
