import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';

export class UmlDestroy extends SimpleShapeNodeDefinition {
  constructor() {
    super('umlDestroy', 'UML Destroy');
  }

  buildShape(props: SimpleShapeNodeDefinitionProps, shapeBuilder: ShapeBuilder): void {
    const { h, w } = props.node.bounds;

    const b = shapeBuilder.buildBoundary();

    b.path(w, 0).line(0, h).move(0, 0).line(w, h);
    b.stroke({}, true);
  }
}
