import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '../node-types/DrawioShape.nodeType';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  registry.register(
    new DrawioShapeNodeDefinition(`mxgraph.salesforce.${toTypeName(name)}`, name, stencil)
  );
};

export const registerSalesforceShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils(
    '$STENCIL_ROOT/stencils/salesforce.xml',
    'Salesforce',
    '#005073',
    '#005073'
  );

  registerStencil(r, 'sales', stencils);
  registerStencil(r, 'service', stencils);
  registerStencil(r, 'marketing', stencils);
  registerStencil(r, 'commerce', stencils);
  registerStencil(r, 'platform', stencils);
  registerStencil(r, 'analytics', stencils);
  registerStencil(r, 'integration', stencils);
  registerStencil(r, 'employees', stencils);
  registerStencil(r, 'learning', stencils);
  registerStencil(r, 'industries', stencils);
  registerStencil(r, 'partners', stencils);
  registerStencil(r, 'success', stencils);
  registerStencil(r, 'inbox', stencils);
  registerStencil(r, 'field service', stencils);
  registerStencil(r, 'iot', stencils);
  registerStencil(r, 'social studio', stencils);
  registerStencil(r, 'sales2', stencils);
  registerStencil(r, 'analytics2', stencils);
  registerStencil(r, 'partners2', stencils);
  registerStencil(r, 'social studio2', stencils);
  registerStencil(r, 'customer 360', stencils);
  registerStencil(r, 'service2', stencils);
  registerStencil(r, 'integration2', stencils);
  registerStencil(r, 'success2', stencils);
  registerStencil(r, 'customer 3602', stencils);
  registerStencil(r, 'heroku2', stencils);
  registerStencil(r, 'work com2', stencils);
  registerStencil(r, 'loyalty2', stencils);
  registerStencil(r, 'iot2', stencils);
  registerStencil(r, 'industries2', stencils);
  registerStencil(r, 'platform2', stencils);
  registerStencil(r, 'loyalty', stencils);
  registerStencil(r, 'work com', stencils);
  registerStencil(r, 'heroku', stencils);
  registerStencil(r, 'marketing2', stencils);
  registerStencil(r, 'commerce2', stencils);
  registerStencil(r, 'employees2', stencils);
  registerStencil(r, 'learning2', stencils);
  registerStencil(r, 'inbox2', stencils);
  registerStencil(r, 'field service2', stencils);
  registerStencil(r, 'apps', stencils);
  registerStencil(r, 'web', stencils);
  registerStencil(r, 'channels', stencils);
  registerStencil(r, 'bots', stencils);
  registerStencil(r, 'automation', stencils);
  registerStencil(r, 'workflow', stencils);
  registerStencil(r, 'personalization', stencils);
  registerStencil(r, 'builders', stencils);
  registerStencil(r, 'data', stencils);
  registerStencil(r, 'stream', stencils);
  registerStencil(r, 'segments', stencils);
  registerStencil(r, 'privacy', stencils);
  registerStencil(r, 'apps2', stencils);
  registerStencil(r, 'web2', stencils);
  registerStencil(r, 'channels2', stencils);
  registerStencil(r, 'bots2', stencils);
  registerStencil(r, 'automation2', stencils);
  registerStencil(r, 'workflow2', stencils);
  registerStencil(r, 'personalization2', stencils);
  registerStencil(r, 'builders2', stencils);
  registerStencil(r, 'data2', stencils);
  registerStencil(r, 'stream2', stencils);
  registerStencil(r, 'segments2', stencils);
  registerStencil(r, 'privacy2', stencils);
  registerStencil(r, 'government', stencils);
  registerStencil(r, 'media', stencils);
  registerStencil(r, 'consumer goods', stencils);
  registerStencil(r, 'transportation and technology', stencils);
  registerStencil(r, 'financial services', stencils);
  registerStencil(r, 'automotive', stencils);
  registerStencil(r, 'energy', stencils);
  registerStencil(r, 'smb', stencils);
  registerStencil(r, 'communications', stencils);
  registerStencil(r, 'retail', stencils);
  registerStencil(r, 'manufacturing', stencils);
  registerStencil(r, 'sustainability', stencils);
  registerStencil(r, 'financial services2', stencils);
  registerStencil(r, 'retail2', stencils);
  registerStencil(r, 'education2', stencils);
  registerStencil(r, 'sustainability2', stencils);
  registerStencil(r, 'manufacturing2', stencils);
  registerStencil(r, 'automotive2', stencils);
  registerStencil(r, 'health', stencils);
  registerStencil(r, 'government2', stencils);
  registerStencil(r, 'media2', stencils);
  registerStencil(r, 'energy2', stencils);
  registerStencil(r, 'philantrophy', stencils);
  registerStencil(r, 'non profit', stencils);
  registerStencil(r, 'education', stencils);
  registerStencil(r, 'smb2', stencils);
  registerStencil(r, 'consumer goods2', stencils);
  registerStencil(r, 'transportation and technology2', stencils);
  registerStencil(r, 'communications2', stencils);
  registerStencil(r, 'non profit2', stencils);
  registerStencil(r, 'philantrophy2', stencils);
  registerStencil(r, 'health2', stencils);
};
