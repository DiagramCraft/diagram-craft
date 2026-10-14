import type {
  ComponentDefinition,
  DashboardWidgetComponentDefinition,
  MdxComponentDefinition
} from './types';

export type {
  ComponentDefinition,
  DashboardWidgetComponentDefinition,
  MdxComponentDefinition,
  MdxComponentSpec,
  DashboardWidgetSpec,
  ComponentIcon
} from './types';

/** Registrations by type, in registration order. */
const definitionsByType = new Map<string, ComponentDefinition>();

/** Narrows component definitions to registrations that provide this surface. */
export type ComponentDefinitionFilter = 'mdx' | 'dashboardWidget';

type ComponentDefinitionFor<Filter extends ComponentDefinitionFilter | undefined> =
  Filter extends 'mdx'
    ? MdxComponentDefinition
    : Filter extends 'dashboardWidget'
      ? DashboardWidgetComponentDefinition
      : ComponentDefinition;

/**
 * `defineComponent` guarantees that a dashboard widget has an icon, a config schema and so a
 * default config, so the presence of the spec is all that needs checking.
 */
const provides = (definition: ComponentDefinition, filter: ComponentDefinitionFilter): boolean =>
  (filter === 'mdx' ? definition.mdx : definition.dashboardWidget) !== undefined;

/** Return all registrations, or narrow them to definitions with the selected spec. */
export const getComponentDefinitions = <
  Filter extends ComponentDefinitionFilter | undefined = undefined
>(
  filter?: Filter
): ReadonlyArray<ComponentDefinitionFor<Filter>> => {
  const all = [...definitionsByType.values()];
  const matching = filter ? all.filter(definition => provides(definition, filter)) : all;
  return matching as unknown as ReadonlyArray<ComponentDefinitionFor<Filter>>;
};

/** Look up a registration by id, optionally requiring a particular spec. */
export const getComponentDefinition = <
  Filter extends ComponentDefinitionFilter | undefined = undefined
>(
  id: string,
  filter?: Filter
): ComponentDefinitionFor<Filter> | undefined => {
  const definition = definitionsByType.get(id);
  if (!definition || (filter && !provides(definition, filter))) return undefined;
  return definition as ComponentDefinitionFor<Filter>;
};

/** Add component registrations; a type may only be registered once. */
export const registerComponentDefinitions = (
  definitions: ReadonlyArray<ComponentDefinition>
): void => {
  for (const definition of definitions) {
    if (definitionsByType.has(definition.type)) {
      throw new Error(`Duplicate component registration for "${definition.type}"`);
    }
    definitionsByType.set(definition.type, definition);
  }
};

let wikiMdxComponents: Record<string, MdxComponentDefinition> | undefined;

/**
 * The MDX components that may appear in wiki content. The wiki parser and renderer must use this
 * rather than the whole registry, so dashboard-only widgets are never recognized there even if
 * stored content names one. Resolved once, after registration has completed.
 */
export const getWikiMdxComponents = (): Record<string, MdxComponentDefinition> => {
  wikiMdxComponents ??= Object.fromEntries(
    getComponentDefinitions('mdx').map(definition => [definition.type, definition])
  );
  return wikiMdxComponents;
};

/**
 * Whether `config` is a valid (and complete) config for the component. Components without a
 * `configSchema` accept anything.
 */
export const isValidComponentConfig = (
  definition: Pick<ComponentDefinition, 'configSchema'> | undefined,
  config: Record<string, unknown>
): boolean => definition?.configSchema?.safeParse(config).success ?? true;
