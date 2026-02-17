import {
  EdgeDefinitionRegistry,
  NodeDefinitionRegistry,
  Registry
} from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { loadStencilsFromYaml } from '@diagram-craft/model/elementDefinitionLoader';
import c4CoreStencils from './c4-core-stencils.yaml';
import { C4ModuleNodeDefinition } from './c4Module';
import { C4CLIRectNodeDefinition } from './c4CLIRect';
import { C4BrowserRectNodeDefinition } from '@diagram-craft/stencil-c4/c4BrowserRect';
import { C4PersonNodeDefinition } from './c4Person';
import { C4FolderNodeDefinition } from './c4Folder';

export const registerC4Nodes = async (nodes: NodeDefinitionRegistry) => {
  nodes.register(new C4ModuleNodeDefinition());
  nodes.register(new C4CLIRectNodeDefinition());
  nodes.register(new C4BrowserRectNodeDefinition());
  nodes.register(new C4PersonNodeDefinition());
  nodes.register(new C4FolderNodeDefinition());
};

export const registerC4Edges = async (_edges: EdgeDefinitionRegistry) => {};

export const loadC4Stencils = async (registry: Registry) => {
  await registerC4Nodes(registry.nodes);

  const c4Stencils: StencilPackage = {
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'core', name: 'Core', stencils: [] },
      { id: 'old', name: 'Old Style', stencils: [] }
    ]
  };

  /* *********************************************************************** */
  /* CORE PACKAGE                                                            */
  /* *********************************************************************** */

  loadStencilsFromYaml(c4CoreStencils).forEach(s => {
    c4Stencils.stencils.push(s);
    c4Stencils.subPackages!.find(p => p.id === 'core')?.stencils.push(s);
  });

  return c4Stencils;
};
