import React from 'react';
import { propsUtils } from '../utils/propsUtils.ts';
import { TextPart } from '../TextPart.tsx';
import { DiagramNode } from '../../model/diagramNode.ts';
import { PathBuilder, unitCoordinateSystem } from '../../geometry/pathBuilder.ts';
import { Point } from '../../geometry/point.ts';
import { AbstractReactNodeDefinition } from '../reactNodeDefinition.ts';
import { Component, s } from '../../base-ui/component.ts';

// TODO: This is exploration
// @ts-ignore
class RectComponent extends Component {
  private path: SVGElement | undefined;

  constructor(private readonly node: DiagramNode) {
    super();
  }

  getPathProps() {
    const path = new RectNodeDefinition().getBoundingPathBuilder(this.node).getPath();

    return {
      d: path.asSvgPath(),
      x: this.node.bounds.x.toString(),
      y: this.node.bounds.y.toString(),
      width: this.node.bounds.w.toString(),
      height: this.node.bounds.h.toString()
    };
  }

  render() {
    const pathProps = this.getPathProps();
    this.path = s('path', pathProps);
    return this.path;
  }

  update(): void {
    const pathProps = this.getPathProps();
    Object.entries(pathProps).forEach(([key, value]) => {
      this.path!.setAttribute(key, value);
    });
  }
}

export const Rect = (props: Props) => {
  const path = new RectNodeDefinition().getBoundingPathBuilder(props.node).getPath();
  const svgPath = path.asSvgPath();

  return (
    <>
      <path
        d={svgPath}
        x={props.node.bounds.x}
        y={props.node.bounds.y}
        width={props.node.bounds.w}
        height={props.node.bounds.h}
        {...propsUtils.filterSvgProperties(props)}
      />
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

export class RectNodeDefinition extends AbstractReactNodeDefinition {
  constructor(name = 'rect', displayName = 'Rectangle') {
    super(name, displayName);
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
}

type Props = {
  node: DiagramNode;
  isSelected: boolean;
  isSingleSelected: boolean;
  nodeProps: NodeProps;
} & React.SVGProps<SVGRectElement>;
