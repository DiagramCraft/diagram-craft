import { toInlineCSS, VNode } from '../component/vdom';
import { Box, Extent, Path } from '@diagram-craft/geometry';
import { Component } from '../component/component';
import { ShapeText, ShapeTextProps } from './ShapeText';
import { DefaultPathRenderer, PathRenderer } from './PathRenderer';
import * as svg from '../component/vdom-svg';
import { BaseShapeBuildProps } from './BaseShape';
import { DiagramNode, UnitOfWork } from '@diagram-craft/model';
import { ControlPoint, ControlPointCallback } from './ShapeControlPoint';
import { SketchPathRenderer } from '@diagram-craft/canvas/effects/sketch';

const defaultOnChange = (node: DiagramNode) => (text: string) => {
  UnitOfWork.execute(node.diagram, uow => {
    node.updateProps(props => {
      props.text ??= {};
      props.text.text = text;
    }, uow);
  });
};

export class ShapeBuilder {
  children: VNode[] = [];
  boundary: Path | undefined = undefined;
  controlPoints: ControlPoint[] = [];

  constructor(private readonly props: BaseShapeBuildProps) {}

  add(vnode: VNode) {
    this.children.push(vnode);
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
    this.children.push(
      cmp.subComponent<ShapeTextProps, ShapeText>('text', () => new ShapeText(), {
        id: `text_${id}_${this.props.node.id}`,
        text: text ?? this.props.nodeProps.text,
        bounds: bounds ?? this.props.node.bounds,
        onMouseDown: this.props.onMouseDown,
        onChange: defaultOnChange(this.props.node),
        onSizeChange: onSizeChange
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
    this.children.push(
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
