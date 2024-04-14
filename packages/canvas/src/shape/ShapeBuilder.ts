import { toInlineCSS, VNode } from '../component/vdom';
import { Component } from '../component/component';
import { ShapeText, ShapeTextProps } from './ShapeText';
import { DefaultPathRenderer, PathRenderer } from './PathRenderer';
import * as svg from '../component/vdom-svg';
import { BaseShapeBuildProps } from './BaseShape';
import { ControlPoint, ControlPointCallback } from './ShapeControlPoint';
import { SketchPathRenderer } from '@diagram-craft/canvas/effects/sketch';
import { Path } from '@diagram-craft/geometry/path';
import { Box } from '@diagram-craft/geometry/box';
import { Extent } from '@diagram-craft/geometry/extent';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

const defaultOnChange = (node: DiagramNode) => (text: string) => {
  UnitOfWork.execute(node.diagram, uow => {
    node.updateProps(props => {
      props.text ??= {};
      props.text.text = text;
    }, uow);
  });
};

export class ShapeBuilder {
  nodes: VNode[] = [];
  boundary: Path | undefined = undefined;
  controlPoints: ControlPoint[] = [];

  constructor(private readonly props: BaseShapeBuildProps) {}

  add(vnode: VNode) {
    this.nodes.push(vnode);
  }

  // TODO: Maybe we can pass Component<any> in the constructor instead
  text(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cmp: Component<any>,
    id: string = '1',
    text?: NodeProps['text'],
    bounds?: Box,
    onSizeChange?: (size: Extent) => void
  ) {
    this.nodes.push(
      cmp.subComponent<ShapeTextProps>(ShapeText, {
        key: `text_${id}_${this.props.node.id}`,
        id: `text_${id}_${this.props.node.id}`,
        text: text ?? this.props.nodeProps.text,
        bounds: bounds ?? this.props.node.bounds,
        tool: this.props.tool,
        onMouseDown: this.props.onMouseDown,
        onChange: defaultOnChange(this.props.node),
        onSizeChange: onSizeChange,
        isSingleSelected: this.props.isSingleSelected
      })
    );
  }

  boundaryPath(path: Path, map: (n: VNode) => VNode = a => a) {
    const pathRenderer: PathRenderer = this.props.node.props.effects?.sketch
      ? new SketchPathRenderer()
      : new DefaultPathRenderer();

    const paths = pathRenderer.render(this.props.node, {
      path: path,
      style: this.props.style
    });
    this.nodes.push(
      ...paths
        .map(path => ({
          d: path.path,
          x: this.props.node.bounds.x.toString(),
          y: this.props.node.bounds.y.toString(),
          width: this.props.node.bounds.w.toString(),
          height: this.props.node.bounds.h.toString(),
          class: 'svg-node__boundary svg-node',
          style: toInlineCSS(path.style)
        }))
        .map(p => map(svg.path(p)))
    );
  }

  controlPoint(x: number, y: number, cb: ControlPointCallback) {
    this.controlPoints.push({ x, y, cb });
  }
}
