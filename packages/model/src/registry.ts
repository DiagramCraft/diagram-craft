import type { NodeDefinitionRegistry } from './nodeDefinitionRegistry';
import type { EdgeDefinitionRegistry } from './edgeDefinitionRegistry';
import type { StencilRegistry } from '@diagram-craft/model/stencilRegistry';

export type Registry = {
  nodes: NodeDefinitionRegistry;
  edges: EdgeDefinitionRegistry;
  stencils: StencilRegistry;
};
