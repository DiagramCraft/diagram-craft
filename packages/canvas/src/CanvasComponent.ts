import { Component, ComponentVNodeData, createEffect, isInComponent } from './component/component';
import * as svg from './component/vdom-svg';
import * as html from './component/vdom-html';
import { Point } from '@diagram-craft/geometry/point';
import { Modifiers } from './dragDropManager';
import { Diagram, DiagramEvents } from '@diagram-craft/model/diagram';
import { ShapeNodeDefinition } from './shape/shapeNodeDefinition';
import { ShapeEdgeDefinition } from './shape/shapeEdgeDefinition';
import { rawHTML } from './component/vdom';
import styles from './canvas.css?inline';
import { Browser } from './browser';
import { isResolvableToRegularLayer, Layer, RegularLayer } from '@diagram-craft/model/diagramLayer';
import { EventKey } from '@diagram-craft/utils/event';
import { Context } from './context';
import { NodeComponentProps } from './components/BaseNodeComponent';
import { assert, VerifyNotReached } from '@diagram-craft/utils/assert';
import { isEdge, isNode } from '@diagram-craft/model/diagramElement';

// TODO: Change EditableCanvasComponent to InteractiveCanvasComponent
//       Change PickerCanvasComponent to StaticCanvasComponent
//       Change CanvasComponentBase to BaseCanvasComponent
//       Add capabilities/callback to InteractiveCanvasComponent

export abstract class CanvasComponentBase<
  P extends {
    id: string;
    width?: number | string | undefined;
    height?: number | string | undefined;
    context: Context;
    className?: string;
  }
> extends Component<P> {
  protected nodeRefs: Map<string, Component<unknown> | null> = new Map();
  protected edgeRefs: Map<string, Component<unknown> | null> = new Map();

  getSvgElement(): SVGSVGElement {
    assert.present(this.currentProps);
    return document.getElementById(this.currentProps.id)! as unknown as SVGSVGElement;
  }

  protected renderLayer(
    layer: Layer<RegularLayer>,
    $d: Diagram,
    onMouseDown: (id: string, coord: Point, modifiers: Modifiers) => void,
    onEdgeDoubleClick: (id: string, coord: Point) => void,

    // TODO: Can we replace this by using this.currentProps instead
    props: P
  ) {
    const diagram = $d;
    return layer.resolveForced().elements.map(e => {
      const id = e.id;

      e.activeDiagram = $d;

      if (isEdge(e)) {
        const edge = e;
        const edgeDef = diagram.document.edgeDefinitions.get(edge.renderProps.shape);

        return this.subComponent(
          () => new (edgeDef as ShapeEdgeDefinition).component!(edgeDef as ShapeEdgeDefinition),
          {
            key: `edge-${id}`,
            onDoubleClick: onEdgeDoubleClick,
            onMouseDown: onMouseDown,
            element: edge,
            context: props.context,
            isReadOnly: layer.type === 'reference'
          },
          {
            onCreate: element => {
              this.edgeRefs.set(
                id,
                (element.data as ComponentVNodeData<unknown>).component.instance!
              );
            },
            onRemove: element => {
              /* Note: Need to check if the instance is the same as the one we have stored,
               *       as removes and adds can come out of order */
              const instance = element.data as ComponentVNodeData<unknown>;
              if (this.edgeRefs.get(id) === instance.component.instance) {
                this.edgeRefs.set(id, null);
              }
            }
          }
        );
      } else if (isNode(e)) {
        const node = e;
        const nodeDef = diagram.document.nodeDefinitions.get(node.nodeType);

        return this.subComponent<NodeComponentProps>(
          () => new (nodeDef as ShapeNodeDefinition).component!(nodeDef as ShapeNodeDefinition),
          {
            key: `node-${node.nodeType}-${id}`,
            element: node,
            onMouseDown: onMouseDown,
            context: props.context,
            isReadOnly: layer.type === 'reference'
          },
          {
            onCreate: element => {
              this.nodeRefs.set(
                id,
                (element.data as ComponentVNodeData<NodeComponentProps>).component.instance!
              );
            },
            onRemove: element => {
              /* Note: Need to check if the instance is the same as the one we have stored,
               *       as removes and adds can come out of order */
              const instance = (element.data as ComponentVNodeData<NodeComponentProps>).component
                .instance;
              if (this.nodeRefs.get(id) === instance) {
                this.nodeRefs.set(id, null);
              }
            }
          }
        );
      } else {
        throw new VerifyNotReached();
      }
    });
  }

  protected onEventRedraw(eventName: EventKey<DiagramEvents>, diagram: Diagram) {
    if (!isInComponent()) return;

    createEffect(() => {
      const cb = () => this.redraw();
      diagram.on(eventName, cb);
      return () => diagram.off(eventName, cb);
    }, [diagram]);
  }

  protected svgFilterDefs() {
    return svg.defs(
      svg.filter(
        { id: 'reflection-filter', filterUnits: 'objectBoundingBox' },
        svg.feGaussianBlur({ stdDeviation: 0.5 })
      )
    );
  }

  protected dimensionAttributes(props: P) {
    return {
      ...(props.width ? { width: props.width } : {}),
      ...(props.height ? { height: props.height } : {})
    };
  }

  protected getClassName(props: P) {
    return [
      props.className ?? this.defaultClassName,
      Browser.isChrome() ? 'browser-chrome' : ''
    ].join(' ');
  }

  protected abstract defaultClassName: string;
}

// TODO: Would be nice to merge this with EditableCanvasComponent
export class CanvasComponent extends CanvasComponentBase<CanvasProps> {
  protected defaultClassName = 'canvas';

  render(props: CanvasProps) {
    const diagram = props.diagram;

    this.onEventRedraw('elementAdd', diagram);
    this.onEventRedraw('elementRemove', diagram);
    this.onEventRedraw('change', diagram);

    return html.svg(
      {
        id: props.id,
        class: this.getClassName(props),

        ...this.dimensionAttributes(props),

        preserveAspectRatio: 'xMidYMid',
        style: `user-select: none`,
        ...(props.viewBox ? { viewBox: props.viewBox } : {}),
        on: {
          click: e => props.onClick?.(e)
        }
      },
      [
        svg.style({}, rawHTML(styles)),
        this.svgFilterDefs(),

        svg.g(
          {},
          ...diagram.layers.visible.flatMap(layer => {
            if (!isResolvableToRegularLayer(layer)) return null;
            return layer.resolveForced().elements.map(e => {
              const id = e.id;
              if (e.type === 'edge') {
                const edge = diagram.edgeLookup.get(id)!;
                const edgeDef = diagram.document.edgeDefinitions.get(edge.renderProps.shape);

                return this.subComponent(
                  () =>
                    new (edgeDef as ShapeEdgeDefinition).component!(edgeDef as ShapeEdgeDefinition),
                  {
                    element: edge,
                    context: props.context,
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
                    context: props.context,
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
}

export type CanvasProps = {
  id: string;
  context: Context;
  className?: string;
  diagram: Diagram;
  width?: number | string;
  height?: number | string;
  onClick?: (e: MouseEvent) => void;
  viewBox?: string;
  onMouseDown?: (_id: string, _coord: Point, _modifiers: Modifiers) => void;
};
