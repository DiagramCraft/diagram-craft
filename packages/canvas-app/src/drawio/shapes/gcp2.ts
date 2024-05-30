import { loadStencil } from '../stencilLoader';
import { NodeDefinitionRegistry, Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { findStencilByName, stencilNameToType } from './shapeUtils';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { PathBuilder, unitCoordinateSystem } from '@diagram-craft/geometry/pathBuilder';
import { Point } from '@diagram-craft/geometry/point';
import { cloneAsWriteable } from '@diagram-craft/utils/types';

const registerStencil = (
  registry: NodeDefinitionRegistry,
  name: string,
  stencils: Array<Stencil>
) => {
  const stencil = findStencilByName(stencils, name);

  stencil.node.name = name;
  stencil.node.type = 'mxgraph.gcp2.' + stencilNameToType(name);

  registry.register(stencil.node, stencil);
};

const NOTCH = 8;

const getNotch = (def: DiagramNode) => {
  const offsetW = 2 * (1 - (def.bounds.w - NOTCH) / def.bounds.w);
  const offsetH = 2 * (1 - (def.bounds.h - NOTCH) / def.bounds.h);
  return { offsetW, offsetH };
};

class DoubleRectNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('mxgraph.gcp2.doubleRect', 'GCP Double Rect', DoubleRectNodeDefinition.Shape);
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));

    const { offsetW, offsetH } = getNotch(def);

    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1 - offsetW, 1));
    pathBuilder.lineTo(Point.of(1 - offsetW, 1 - offsetH));
    pathBuilder.lineTo(Point.of(1, 1 - offsetH));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1 + offsetW, -1));
    pathBuilder.lineTo(Point.of(-1 + offsetW, -1 + offsetH));
    pathBuilder.lineTo(Point.of(-1, -1 + offsetH));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  static Shape = class extends BaseNodeComponent<DoubleRectNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      super.buildShape(props, shapeBuilder);

      const bounds = props.node.bounds;
      const { offsetW, offsetH } = getNotch(props.node);

      // Draw additional shape details
      const pathBuilder = new PathBuilder(unitCoordinateSystem(bounds));

      pathBuilder.moveTo(Point.of(-1 + offsetW, -1 + offsetH));
      pathBuilder.lineTo(Point.of(1 - offsetW, -1 + offsetH));
      pathBuilder.lineTo(Point.of(1 - offsetW, 1 - offsetH));

      const lineProps = cloneAsWriteable(props.nodeProps);
      lineProps.shadow!.enabled = false;
      shapeBuilder.path(pathBuilder.getPaths().all(), lineProps);
    }
  };
}

export const registerGCP2Shapes = async (r: NodeDefinitionRegistry) => {
  const stencils = await loadStencil('/stencils/gcp2.xml', 'GCP', '#00BEF2', 'white');

  r.register(new DoubleRectNodeDefinition(), { hidden: true });

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
