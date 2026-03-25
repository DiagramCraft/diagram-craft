import { NodeDefinitionRegistry, Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { YamlStencilLoader } from '@diagram-craft/model/yamlStencilLoader';
import c4CoreStencils from './c4-core-stencils.yaml';
import c4OldStencils from './c4-old-stencils.yaml';
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

export const loadC4Stencils = async (registry: Registry) => {
  await registerC4Nodes(registry.nodes);

  const c4Stencils: StencilPackage = {
    id: 'c4',
    stencils: [],
    type: 'default',

    subPackages: [
      { id: 'core', name: 'Core', stencils: [] },
      { id: 'old', name: 'Old Style', stencils: [] }
    ]
  };
  const loader = new YamlStencilLoader(c4Stencils);

  /* *********************************************************************** */
  /* CORE PACKAGE                                                            */
  /* *********************************************************************** */

  loader.registerSubPackage('core', c4CoreStencils);

  /* *********************************************************************** */
  /* OLD STYLE PACKAGE                                                       */
  /* *********************************************************************** */

  loader.registerSubPackage('old', c4OldStencils);

  return loader.apply();
};
