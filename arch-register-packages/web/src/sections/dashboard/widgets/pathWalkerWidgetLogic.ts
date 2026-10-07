import { MAX_PATH_HOPS, type PathStep } from '@arch-register/api-types/entityQueryIR';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { resolveRelationSchemaNames } from '../../markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedFieldResolution';
import { pathWalkerHops, hopOptionsFrom } from '../../entities/components/pathWalkerViewState';
import {
  pathStepKey,
  type PathStepOption
} from '../../entities/components/pathBuilder/pathBuilderState';

export type PathWalkerWidgetConfig = {
  /** Name (or id) of the entity type listed in the first column. */
  rootSchemaName: string;
  /** The relationship chain the walker opens with; each step may name its relation schema by
   *  name, since a seed can't know workspace-specific ids. Viewers can still re-pick hops. */
  hops?: PathStep[];
  label?: string;
};

export const isPathWalkerConfigValid = (
  config: Record<string, unknown>
): config is PathWalkerWidgetConfig =>
  typeof config.rootSchemaName === 'string' &&
  (config.label === undefined || typeof config.label === 'string') &&
  (config.hops === undefined ||
    (Array.isArray(config.hops) &&
      config.hops.length <= MAX_PATH_HOPS &&
      pathWalkerHops({ hops: config.hops }).length === config.hops.length));

export const isPathWalkerConfigComplete = (config: PathWalkerWidgetConfig): boolean =>
  config.rootSchemaName.length > 0;

export const findRootSchema = (
  config: PathWalkerWidgetConfig,
  schemas: readonly EntitySchema[]
): EntitySchema | undefined =>
  schemas.find(schema => schema.id === config.rootSchemaName) ??
  schemas.find(schema => schema.name === config.rootSchemaName);

/** The opening hop chain with relation-schema names resolved to this workspace's ids. */
export const resolveWalkerHops = (
  config: PathWalkerWidgetConfig,
  relationSchemas: readonly RelationSchema[]
): PathStep[] => resolveRelationSchemaNames(config.hops ?? [], relationSchemas);

export type HopChainOptions = {
  options: PathStepOption[];
  /** Entity type the hop at this index leaves from. */
  fromSchemaId: string;
};

/** Per-index choices for editing a chain: hop `i` may leave from the (single) type hop `i - 1`
 *  lands on. Stops after the first hop that doesn't resolve to exactly one entity type. */
export const hopChainOptions = ({
  rootSchemaId,
  hops,
  schemas,
  relationSchemas
}: {
  rootSchemaId: string;
  hops: PathStep[];
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
}): HopChainOptions[] => {
  const result: HopChainOptions[] = [];
  let from: string | undefined = rootSchemaId;
  for (let i = 0; i <= hops.length && i < MAX_PATH_HOPS && from; i += 1) {
    const options = hopOptionsFrom({ schemaId: from, schemas, relationSchemas });
    result.push({ options, fromSchemaId: from });
    const hop = hops[i];
    if (!hop) break;
    const key = pathStepKey(hop);
    const targets: string[] =
      options.find(option => pathStepKey(option.step) === key)?.targetSchemaIds ?? [];
    from = targets.length === 1 ? targets[0] : undefined;
  }
  return result;
};
