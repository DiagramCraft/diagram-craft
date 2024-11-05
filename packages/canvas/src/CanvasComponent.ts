import { Component } from './component/component';
import * as svg from './component/vdom-svg';
import * as html from './component/vdom-html';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from './dragDropManager';
import { Diagram } from '@diagram-craft/model/diagram';
import { ShapeNodeDefinition } from './shape/shapeNodeDefinition';
import { ShapeEdgeDefinition } from './shape/shapeEdgeDefinition';
import { rawHTML } from './component/vdom';
import styles from './canvas.css?inline';
import { Browser } from './browser';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayer';

// TODO: Would be nice to merge this with EditableCanvasComponent
export class CanvasComponent extends Component<CanvasProps> {
  // TODO: Maybe this should go into a PickerCanvasComponent subclass instead.
  //       It's here to make the PickerCanvas more performant
  protected getMemoKey(props: CanvasProps): unknown | undefined {
    return {
      id: props.diagram.id,
      width: props.width,
      height: props.height,
      viewBox: props.viewBox,
      onClick: props.onClick,
      className: props.className
    };
  }

  render(props: CanvasProps) {
    const diagram = props.diagram;

    return html.svg(
      {
        ...(props.width ? { width: props.width } : {}),
        ...(props.height ? { height: props.height } : {}),
        id: `diagram-${diagram.id}`,
        class: (props.className ?? 'canvas') + ' ' + (Browser.isChrome() ? 'browser-chrome' : ''),
        preserveAspectRatio: 'xMidYMid',
        style: `user-select: none`,
        ...(props.viewBox ? { viewBox: props.viewBox } : {}),
        on: {
          click: e => props.onClick?.(e)
        }
      },
      [
        svg.style({}, rawHTML(styles)),
        svg.defs(
          svg.filter(
            { id: 'reflection-filter', filterUnits: 'objectBoundingBox' },
            svg.feGaussianBlur({ stdDeviation: 0.5 })
          )
        ),

        svg.g(
          {},
          ...diagram.layers.visible.flatMap(layer => {
            assertRegularLayer(layer);
            return layer.elements.map(e => {
              const id = e.id;
              if (e.type === 'edge') {
                const edge = diagram.edgeLookup.get(id)!;
                const edgeDef = diagram.document.edgeDefinitions.get(edge.renderProps.shape);

                return this.subComponent(
                  () =>
                    new (edgeDef as ShapeEdgeDefinition).component!(edgeDef as ShapeEdgeDefinition),
                  {
                    element: edge,
                    // @ts-ignore
                    context: {},
                    onMouseDown:
                      props.onMouseDown ??
                      ((_id: string, _coord: Point, _modifiers: Modifiers) => {})
                  }
                );
              } else {
                const node = diagram.nodeLookup.get(id)!;
                const nodeDef = diagram.document.nodeDefinitions.get(node.nodeType);

                return this.subComponent(
                  () =>
                    new (nodeDef as ShapeNodeDefinition).component!(nodeDef as ShapeNodeDefinition),
                  {
                    key: `node-${node.nodeType}-${id}`,
                    element: node,
                    // @ts-ignore
                    context: {},
                    onMouseDown:
                      props.onMouseDown ??
                      ((_id: string, _coord: Point, _modifiers: Modifiers) => {})
                  }
                );
              }
            });
          })
        )
      ]
    );
  }

  getSvgElement() {
    // TODO: Make this a bit more robust - perhaps by searching by id instead
    return (this.element!.el! as HTMLElement).getElementsByTagName('svg').item(0) as SVGSVGElement;
  }
}

export type CanvasProps = {
  className?: string;
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
  viewBox?: string;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
