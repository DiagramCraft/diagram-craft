import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { Point } from '../geometry/point.ts';
import { Component } from '../base-ui/component.ts';
import { Diagram } from '../model/diagram.ts';
import * as svg from '../base-ui/vdom-svg.ts';
import * as html from '../base-ui/vdom-html.ts';
import { EdgeComponent } from '../react-canvas-viewer/EdgeComponent.ts';
import { Modifiers } from '../base-ui/drag/dragDropManager.ts';

type Ref<T> = { current: T };

// TODO: Would be nice to merge this with EditableCanvasComponent
class CanvasComponent extends Component<Props> {
  // @ts-ignore
  private svgRef: Ref<SVGSVGElement> = { current: undefined };

  render(props: Props) {
    const diagram = props.diagram;

    return html.svg(
      {
        ...(props.width ? { width: props.width } : {}),
        ...(props.height ? { height: props.height } : {}),
        id: `diagram-${diagram.id}`,
        class: props.className ?? '',
        preserveAspectRatio: 'none',
        style: `user-select: none`,
        hooks: {
          onInsert: node => {
            this.svgRef.current = node.el! as SVGSVGElement;
          },
          onRemove: () => {
            // @ts-ignore
            this.svgRef.current = null;
          }
        },
        on: {
          click: e => props?.onClick?.(e)
        }
      },
      [
        svg.defs(
          svg.filter(
            { id: 'reflection-filter', filterUnits: 'objectBoundingBox' },
            svg.feGaussianBlur({ stdDeviation: 0.5 })
          )
        ),

        svg.g(
          {},
          ...diagram.layers.visible.flatMap(layer => {
            return layer.elements.map(e => {
              const id = e.id;
              if (e.type === 'edge') {
                const edge = diagram.edgeLookup.get(id)!;
                return this.subComponent(`edge-${id}`, () => new EdgeComponent(), {
                  def: edge,
                  diagram,
                  applicationTriggers: {},
                  onMouseDown: (_id: string, _coord: Point, _modifiers: Modifiers) => {}
                });
              } else {
                const node = diagram.nodeLookup.get(id)!;
                const nodeDef = diagram.nodeDefinitions.get(node.nodeType);

                return this.subComponent(
                  `node-${node.nodeType}-${id}`,
                  // @ts-ignore
                  (nodeDef as ReactNodeDefinition).component!,
                  {
                    def: node,
                    diagram,
                    applicationTriggers: {},
                    onMouseDown: (_id: string, _coord: Point, _modifiers: Modifiers) => {}
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

export const Canvas = forwardRef<SVGSVGElement, Props>((props, _ref) => {
  const diagram = props.diagram;
  const svgRef = useRef<SVGSVGElement | null>(null);

  const ref = useRef<HTMLDivElement>(null);
  const cmpRef = useRef<CanvasComponent>(new CanvasComponent());

  const cmpProps: Props = {
    ...props,
    diagram
  };

  if (ref.current) {
    cmpRef.current.update(cmpProps);
  }

  useImperativeHandle(_ref, () => svgRef.current!, [svgRef.current]);

  useEffect(() => {
    if (cmpRef.current.isRendered()) return;
    cmpRef.current.attach(ref.current!, cmpProps);
    svgRef.current = cmpRef.current.getSvgElement();
  });

  return <div ref={ref}></div>;
});

type Props = {
  className?: string;
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
};
