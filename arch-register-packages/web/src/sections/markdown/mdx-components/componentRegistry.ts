import type {
  ComponentDefinition,
  DashboardWidgetSpec,
  MdxComponentDefinition,
  MdxComponentSpec
} from './types';

export type {
  ComponentDefinition,
  MdxComponentDefinition,
  SlashCommandDef,
  EditorSpec,
  MdxComponentSpec,
  DashboardWidgetSpec
} from './types';

const componentDefinitions: ComponentDefinition[] = [];
const componentsByType = new Map<string, ComponentDefinition>();

const isMdxComponentDefinition = (
  definition: ComponentDefinition
): definition is MdxComponentDefinition => definition.mdx !== undefined;

/** All component registrations, populated by componentRegistrations.ts. */
export const getComponentDefinitions = (): ReadonlyArray<ComponentDefinition> => [
  ...componentDefinitions
];

/** MDX-capable component definitions, including their MDX-specific spec. */
export const getMdxComponentDefinitions = (): ReadonlyArray<MdxComponentDefinition> =>
  componentDefinitions.filter(isMdxComponentDefinition);

export const getMdxComponentDefinition = (type: string): MdxComponentDefinition | undefined => {
  const definition = componentsByType.get(type);
  return definition && isMdxComponentDefinition(definition) ? definition : undefined;
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

export const getDashboardWidgetSpecs = (): Array<{
  type: string;
  category: ComponentDefinition['category'];
  spec: DashboardWidgetSpec;
}> =>
  componentDefinitions.flatMap(definition =>
    definition.surfaces.includes('dashboard') && definition.dashboardWidget
      ? [{ type: definition.type, category: definition.category, spec: definition.dashboardWidget }]
      : []
  );

export const getDashboardWidgetSpec = (type: string): DashboardWidgetSpec | undefined => {
  const definition = componentsByType.get(type);
  return definition?.surfaces.includes('dashboard') ? definition.dashboardWidget : undefined;
};

export const getMdxSpec = (name: string): MdxComponentSpec => {
  const spec = getMdxComponentDefinition(name)?.mdx;
  if (!spec) throw new Error(`No MDX component spec registered for "${name}"`);
  return spec;
};

/** MDX specs available on the requested content surface. */
export const getMdxSpecsForSurface = (
  surface: 'wiki' | 'dashboard'
): Record<string, MdxComponentSpec> =>
  Object.fromEntries(
    getMdxComponentDefinitions().flatMap(definition =>
      definition.surfaces.includes(surface) ? [[definition.type, definition.mdx] as const] : []
    )
  );
