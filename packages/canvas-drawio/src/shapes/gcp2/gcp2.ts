import {
  DrawioStencil,
  findStencilByName,
  loadDrawioStencils,
  toTypeName
} from '../../drawioStencilLoader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '../../DrawioShape.nodeType';
import { GCPDoubleRectNodeDefinition } from './gcpDoubleRect.nodeType';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<DrawioStencil>
) => {
  const stencil = findStencilByName(stencils, name);

  registry.register(
    new DrawioShapeNodeDefinition(`mxgraph.gcp2.${toTypeName(name)}`, name, stencil)
  );
};

export const registerGCP2Shapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadDrawioStencils('/stencils/gcp2.xml', 'GCP', '#00BEF2', 'white');

  r.register(new GCPDoubleRectNodeDefinition());

  registerStencil(r, 'google cloud platform', stencils);
  registerStencil(r, 'gateway', stencils);
  registerStencil(r, 'memcache', stencils);
  registerStencil(r, 'logs api', stencils);
  registerStencil(r, 'cluster', stencils);
  registerStencil(r, 'nat', stencils);
  registerStencil(r, 'squid proxy', stencils);
  registerStencil(r, 'dedicated game server', stencils);
  registerStencil(r, 'network load balancer', stencils);
  registerStencil(r, 'push notification service', stencils);
  registerStencil(r, 'bucket', stencils);
  registerStencil(r, 'frontend platform services', stencils);
  registerStencil(r, 'application system', stencils);
  registerStencil(r, 'persistent disk snapshot', stencils);
  registerStencil(r, 'blank', stencils);
  registerStencil(r, 'service discovery', stencils);
  registerStencil(r, 'google network edge cache', stencils);
  registerStencil(r, 'virtual file system', stencils);
  registerStencil(r, 'task queues', stencils);
  registerStencil(r, 'external payment form', stencils);
  registerStencil(r, 'image services', stencils);
  registerStencil(r, 'internal payment authorization', stencils);
  registerStencil(r, 'scheduled tasks', stencils);
  registerStencil(r, 'application', stencils);
  registerStencil(r, 'beacon', stencils);
  registerStencil(r, 'circuit board', stencils);
  registerStencil(r, 'database', stencils);
  registerStencil(r, 'desktop', stencils);
  registerStencil(r, 'desktop and mobile', stencils);
  registerStencil(r, 'list', stencils);
  registerStencil(r, 'phone', stencils);
  registerStencil(r, 'storage', stencils);
  registerStencil(r, 'game', stencils);
  registerStencil(r, 'gateway icon', stencils);
  registerStencil(r, 'laptop', stencils);
  registerStencil(r, 'lightbulb', stencils);
  registerStencil(r, 'live', stencils);
  registerStencil(r, 'compute engine icon', stencils);
  registerStencil(r, 'mobile devices', stencils);
  registerStencil(r, 'payment', stencils);
  registerStencil(r, 'record', stencils);
  registerStencil(r, 'report', stencils);
  registerStencil(r, 'retail', stencils);
  registerStencil(r, 'speaker', stencils);
  registerStencil(r, 'stream', stencils);
  registerStencil(r, 'users', stencils);
  registerStencil(r, 'webcam', stencils);
};
