import { Registry } from '@diagram-craft/model/elementDefinitionRegistry';
import { StencilPackage } from '@diagram-craft/model/stencilRegistry';
import { YamlStencilLoader } from '@diagram-craft/canvas/yamlStencilLoader';
import archimateApplicationStencils from './archimate-application-stencils.yaml';
import archimateBusinessStencils from './archimate-business-stencils.yaml';
import archimateImplementationStencils from './archimate-implementation-stencils.yaml';
import archimateMotivationStencils from './archimate-motivation-stencils.yaml';
import archimateRelationshipsStencils from './archimate-relationships-stencils.yaml';
import archimateStrategyStencils from './archimate-strategy-stencils.yaml';
import archimateStyles from './archimate-styles.yaml';
import archimateTechnologyStencils from './archimate-technology-stencils.yaml';

export const loadArchimateStencils = async (_registry: Registry) => {
  const archimateStencilPkg: StencilPackage = {
    id: 'archimate',
    stencils: [],
    type: 'default',
    subPackages: [
      { id: 'business', name: 'Business', stencils: [] },
      { id: 'application', name: 'Application', stencils: [] },
      { id: 'technology', name: 'Technology', stencils: [] },
      { id: 'relationships', name: 'Relationships', stencils: [] },
      { id: 'motivation', name: 'Motivation', stencils: [] },
      { id: 'strategy', name: 'Strategy', stencils: [] },
      { id: 'implementation', name: 'Implementation & Migration', stencils: [] }
    ]
  };

  const loader = new YamlStencilLoader(archimateStencilPkg);
  loader.registerStyles(archimateStyles);
  loader.registerSubPackage('business', archimateBusinessStencils);
  loader.registerSubPackage('application', archimateApplicationStencils);
  loader.registerSubPackage('technology', archimateTechnologyStencils);
  loader.registerSubPackage('relationships', archimateRelationshipsStencils);
  loader.registerSubPackage('motivation', archimateMotivationStencils);
  loader.registerSubPackage('strategy', archimateStrategyStencils);
  loader.registerSubPackage('implementation', archimateImplementationStencils);

  return loader.apply();
};
