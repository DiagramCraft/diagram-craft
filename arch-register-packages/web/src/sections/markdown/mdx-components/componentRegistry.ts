import type {
  ComponentDefinition,
  DashboardWidgetComponentDefinition,
  MdxComponentDefinition,
} from './types';

export type {
  ComponentDefinition,
  DashboardWidgetComponentDefinition,
  MdxComponentDefinition,
  SlashCommandDef,
  EditorSpec,
  MdxComponentSpec,
  DashboardWidgetSpec
} from './types';

const componentDefinitions: ComponentDefinition[] = [];
const componentsByType = new Map<string, ComponentDefinition>();

/** Narrows component definitions to registrations that provide this surface. */
export type ComponentDefinitionFilter = 'mdx' | 'dashboardWidget';

type ComponentDefinitionFor<Filter extends ComponentDefinitionFilter | undefined> =
  Filter extends 'mdx'
    ? MdxComponentDefinition
    : Filter extends 'dashboardWidget'
      ? DashboardWidgetComponentDefinition
      : ComponentDefinition;

const isMdxComponentDefinition = (
  definition: ComponentDefinition
): definition is MdxComponentDefinition => definition.mdx !== undefined;

const isDashboardWidgetComponentDefinition = (
  definition: ComponentDefinition
): definition is DashboardWidgetComponentDefinition =>
  definition.surfaces.includes('dashboard') &&
  definition.dashboardWidget !== undefined &&
  definition.createDefaultProps !== undefined;

/** Return all registrations, or narrow them to definitions with the selected spec. */
export const getComponentDefinitions = <
  Filter extends ComponentDefinitionFilter | undefined = undefined
>(
  filter?: Filter
): ReadonlyArray<ComponentDefinitionFor<Filter>> => {
  if (filter === 'mdx') {
    return componentDefinitions.filter(isMdxComponentDefinition) as unknown as ReadonlyArray<
      ComponentDefinitionFor<Filter>
    >;
  }
  if (filter === 'dashboardWidget') {
    return componentDefinitions.filter(
      isDashboardWidgetComponentDefinition
    ) as unknown as ReadonlyArray<ComponentDefinitionFor<Filter>>;
  }
  return [...componentDefinitions] as unknown as ReadonlyArray<ComponentDefinitionFor<Filter>>;
};

/** Look up a registration by id, optionally requiring a particular spec. */
export const getComponentDefinition = <
  Filter extends ComponentDefinitionFilter | undefined = undefined
>(
  id: string,
  filter?: Filter
): ComponentDefinitionFor<Filter> | undefined => {
  const definition = componentsByType.get(id);
  if (!definition) return undefined;

  if (filter === 'mdx') {
    return isMdxComponentDefinition(definition)
      ? (definition as ComponentDefinitionFor<Filter>)
      : undefined;
  }
  if (filter === 'dashboardWidget') {
    return isDashboardWidgetComponentDefinition(definition)
      ? (definition as ComponentDefinitionFor<Filter>)
      : undefined;
  }
  return definition as ComponentDefinitionFor<Filter>;
};

/** Add the complete set of component registrations. */
export const registerComponentDefinitions = (
  definitions: ReadonlyArray<ComponentDefinition>
): void => {
  const batchTypes = new Set<string>();

  for (const definition of definitions) {
    if (batchTypes.has(definition.type)) {
      throw new Error(`Duplicate component registration for "${definition.type}"`);
    }
    batchTypes.add(definition.type);
  }

  componentDefinitions.push(...definitions);

  for (const definition of definitions) {
    componentsByType.set(definition.type, definition);
  }
};

/** MDX specs available on the requested content surface. */
export const getMdxComponentDefinitionsForSurface = (
  surface: 'wiki' | 'dashboard'
): Record<string, MdxComponentDefinition> =>
  Object.fromEntries(
    getComponentDefinitions('mdx').flatMap(definition =>
      definition.surfaces.includes(surface) ? [[definition.type, definition] as const] : []
    )
  );
