import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { UnitOfWork } from '@diagram-craft/model';
import { DiagramNode } from '@diagram-craft/model';
import { ShapeNodeDefinition } from '../shapeNodeDefinition.ts';
import { Extent, PathBuilder, Point, unitCoordinateSystem } from '@diagram-craft/geometry';

export class TextNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('text', 'Test', () => new TextComponent(this));
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(-1, 1));
    pathBuilder.lineTo(Point.of(1, 1));
    pathBuilder.lineTo(Point.of(1, -1));
    pathBuilder.lineTo(Point.of(-1, -1));
    pathBuilder.lineTo(Point.of(-1, 1));

    return pathBuilder;
  }

  getDefaultProps(_mode: 'picker' | 'canvas'): NodeProps {
    return {
      style: 'default-text',

      // TODO: Remove all of this
      stroke: {
        enabled: false
      },
      fill: {
        enabled: false
      },
      text: {
        align: 'left',
        text: 'Text',
        left: 0,
        top: 0,
        right: 0,
        bottom: 0
      }
    };
  }

  getInitialConfig(): { size: Extent } {
    return { size: { w: 100, h: 10 } };
  }
}

class TextComponent extends BaseShape {
  buildShape(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = this.nodeDefinition.getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text(this, '1', props.nodeProps.text, props.node.bounds, (size: Extent) => {
      const width = size.w;
      const height = size.h;

      UnitOfWork.execute(props.node.diagram!, uow => {
        props.node.setBounds(
          {
            ...props.node.bounds,
            h: height,
            w: width
          },
          uow
        );
      });

      props.node.diagram!.selectionState.rebaseline();
    });
  }
}
