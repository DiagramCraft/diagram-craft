import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { deepClone } from '@diagram-craft/utils/object';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { makeWriteable } from '@diagram-craft/utils/types';

export class DrawioTransparentNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'transparent', displayName = 'Transparent') {
    super(name, displayName, DrawioTransparentComponent);
  }
}

class DrawioTransparentComponent extends BaseNodeComponent {
  buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();

    const p = makeWriteable(deepClone(props.nodeProps));
    p.stroke!.color = 'transparent';
    p.stroke!.enabled = false;
    p.fill!.color = 'transparent';
    p.fill!.enabled = false;

    shapeBuilder.boundaryPath(boundary.all(), p);
    shapeBuilder.text(this);
  }
}
