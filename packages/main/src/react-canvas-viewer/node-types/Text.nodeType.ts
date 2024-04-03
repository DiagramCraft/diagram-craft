import { RectNodeDefinition } from './Rect.nodeType.ts';
import { Extent } from '../../geometry/extent.ts';
import { BaseShape, BaseShapeBuildProps, ShapeBuilder } from '../temp/baseShape.temp.ts';
import { UnitOfWork } from '../../model/unitOfWork.ts';

export class TextNodeDefinition extends RectNodeDefinition {
  constructor() {
    super('text', 'Test');
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

export class TextComponent extends BaseShape {
  build(props: BaseShapeBuildProps, shapeBuilder: ShapeBuilder) {
    const boundary = new TextNodeDefinition().getBoundingPathBuilder(props.node).getPath();

    shapeBuilder.boundaryPath(boundary);
    shapeBuilder.text('1', props.nodeProps.text, props.node.bounds, (size: Extent) => {
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
