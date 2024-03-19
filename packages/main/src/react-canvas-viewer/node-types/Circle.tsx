import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition, ReactNodeProps } from '../reactNodeDefinition.ts';
import { FilledPath } from '../FilledPath.tsx';

declare global {
  interface NodeProps {}
}

export const Circle = (props: Props) => {
  const path = new CircleNodeDefinition().getBoundingPathBuilder(props.node).getPath();

  return (
    <>
      <FilledPath p={path} {...props} />

      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={TextPart.defaultOnChange(props.node)}
        onMouseDown={props.onMouseDown!}
      />
    </>
  );
};

export class CircleNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('circle', 'Circle');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const b = new PathBuilder(unitCoordinateSystem(def.bounds));
    b.moveTo(Point.of(0, -1));
    b.arcTo(Point.of(1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, 1), 0.5, 0.5);
    b.arcTo(Point.of(-1, 0), 0.5, 0.5);
    b.arcTo(Point.of(0, -1), 0.5, 0.5);
    return b;
  }
}

type Props = ReactNodeProps;
