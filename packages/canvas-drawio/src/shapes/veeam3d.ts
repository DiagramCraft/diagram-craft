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
    new DrawioShapeNodeDefinition(`mxgraph.veeam.3d.${toTypeName(name)}`, name, stencil)
  );
};

export const registerVeeam3dShapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils('/stencils/veeam/3d.xml', 'Veeam', 'black', 'white');

  registerStencil(r, '1ftvm', stencils);
  registerStencil(r, '1ftvm error', stencils);
  registerStencil(r, '1ftvm running', stencils);
  registerStencil(r, '1ftvm unavailable', stencils);
  registerStencil(r, '1ftvm warning', stencils);
  registerStencil(r, '2ftvm', stencils);
  registerStencil(r, '2ftvm error', stencils);
  registerStencil(r, '2ftvm running', stencils);
  registerStencil(r, '2ftvm unavailable', stencils);
  registerStencil(r, '2ftvm warning', stencils);
  registerStencil(r, 'backup repository', stencils);
  registerStencil(r, 'backup repository 2', stencils);
  registerStencil(r, 'cd', stencils);
  registerStencil(r, 'database', stencils);
  registerStencil(r, 'datastore', stencils);
  registerStencil(r, 'datastore snapshot', stencils);
  registerStencil(r, 'datastore volume', stencils);
  registerStencil(r, 'esx esxi', stencils);
  registerStencil(r, 'failover protective snapshot', stencils);
  registerStencil(r, 'failover protective snapshot locked', stencils);
  registerStencil(r, 'failover protective snapshot running', stencils);
  registerStencil(r, 'free datastore', stencils);
  registerStencil(r, 'full datastore', stencils);
  registerStencil(r, 'hard drive', stencils);
  registerStencil(r, 'hyper v host', stencils);
  registerStencil(r, 'lost space', stencils);
  registerStencil(r, 'lun', stencils);
  registerStencil(r, 'medium datastore', stencils);
  registerStencil(r, 'network card', stencils);
  registerStencil(r, 'physical storage', stencils);
  registerStencil(r, 'proxy', stencils);
  registerStencil(r, 'proxy appliance', stencils);
  registerStencil(r, 'remote site', stencils);
  registerStencil(r, 'remote storage', stencils);
  registerStencil(r, 'resource pool', stencils);
  registerStencil(r, 'service vnic', stencils);
  registerStencil(r, 'switch', stencils);
  registerStencil(r, 'tape', stencils);
  registerStencil(r, 'tape checked', stencils);
  registerStencil(r, 'tape ejecting', stencils);
  registerStencil(r, 'tape library', stencils);
  registerStencil(r, 'tape licensed', stencils);
  registerStencil(r, 'tape recording', stencils);
  registerStencil(r, 'tape server', stencils);
  registerStencil(r, 'vapp', stencils);
  registerStencil(r, 'vapp started', stencils);
  registerStencil(r, 'veeam one business view', stencils);
  registerStencil(r, 'vmware host', stencils);
  registerStencil(r, 'vm running', stencils);
  registerStencil(r, 'workstation', stencils);
  registerStencil(r, 'veeam availability suite', stencils);
  registerStencil(r, 'veeam backup and replication server', stencils);
  registerStencil(r, 'veeam backup enterprise manager server', stencils);
  registerStencil(r, 'veeam backup search server', stencils);
  registerStencil(r, 'veeam one monitor', stencils);
  registerStencil(r, 'veeam one reporter', stencils);
  registerStencil(r, 'veeam one server', stencils);
  registerStencil(r, 'virtual machine', stencils);
  registerStencil(r, 'vm failed', stencils);
  registerStencil(r, 'vm linux', stencils);
  registerStencil(r, 'vm no network', stencils);
  registerStencil(r, 'vm problem', stencils);
  registerStencil(r, 'vm saved state', stencils);
  registerStencil(r, 'vm windows', stencils);
  registerStencil(r, 'vnic', stencils);
  registerStencil(r, 'wan accelerator', stencils);
};
