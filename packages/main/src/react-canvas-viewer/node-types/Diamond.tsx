import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition, ReactNodeProps } from '../reactNodeDefinition.ts';
import { FilledPath } from '../FilledPath.tsx';
import { NodeWrapper } from '../NodeWrapper.tsx';

export const Diamond = (props: Props) => {
  const path = new DiamondNodeDefinition().getBoundingPathBuilder(props.node).getPath();

  return (
    <NodeWrapper node={props.node} path={path}>
      <FilledPath p={path} {...props} />

      <TextPart
        id={`text_1_${props.node.id}`}
        text={props.nodeProps.text}
        bounds={props.node.bounds}
        onChange={TextPart.defaultOnChange(props.node)}
        onMouseDown={props.onMouseDown!}
      />
    </NodeWrapper>
  );
};

export class DiamondNodeDefinition extends AbstractReactNodeDefinition {
  constructor() {
    super('diamond', 'Diamond');
  }

  getBoundingPathBuilder(def: DiagramNode) {
    const pathBuilder = new PathBuilder(unitCoordinateSystem(def.bounds));
    pathBuilder.moveTo(Point.of(0, 1));
    pathBuilder.lineTo(Point.of(1, 0));
    pathBuilder.lineTo(Point.of(0, -1));
    pathBuilder.lineTo(Point.of(-1, 0));
    pathBuilder.lineTo(Point.of(0, 1));

    return pathBuilder;
  }
}

type Props = ReactNodeProps;
