import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { YamlStencilLoader } from '@diagram-craft/canvas/yamlStencilLoader';
import archimateStencils from './archimate-stencils.yaml';

export const loadArchimateStencils = async (_registry: Registry) => {
  const archimateStencilPkg: StencilPackage = {
    id: 'archimate',
    stencils: [],
    type: 'default'
  };

  const loader = new YamlStencilLoader(archimateStencilPkg);
  loader.registerSubPackage('main', archimateStencils);

  return loader.apply();
};
