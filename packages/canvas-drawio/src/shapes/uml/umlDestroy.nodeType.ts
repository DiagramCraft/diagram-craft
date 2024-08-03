import {
  SimpleShapeNodeDefinition,
  SimpleShapeNodeDefinitionProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Anchor } from '@diagram-craft/model/anchor';
import { Point } from '@diagram-craft/geometry/point';

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

  getAnchors(_node: DiagramNode): Anchor[] {
    return [{ id: 'c', type: 'center', start: Point.of(0.5, 0.5) }];
  }
}
