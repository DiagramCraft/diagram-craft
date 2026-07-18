import type { NodeDefinitionRegistry } from './nodeDefinitionRegistry';
import type { EdgeDefinitionRegistry } from './edgeDefinitionRegistry';

export type NodeDefinitionLoader = (nodes: NodeDefinitionRegistry) => Promise<void>;
export type EdgeDefinitionLoader = (edges: EdgeDefinitionRegistry) => Promise<void>;

export type LazyElementLoaderEntry = {
  shapes: RegExp;
  nodeDefinitionLoader?: () => Promise<NodeDefinitionLoader>;
  edgeDefinitionLoader?: () => Promise<EdgeDefinitionLoader>;
};
