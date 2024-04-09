import { Component } from './component/component.ts';
import { Diagram } from '@diagram-craft/model';
import * as svg from './component/vdom-svg.ts';
import * as html from './component/vdom-html.ts';
import { EdgeComponent } from './EdgeComponent.ts';
import { Point } from '@diagram-craft/geometry';
import { Modifiers } from './drag/dragDropManager.ts';

type Ref<T> = { current: T };

// TODO: Would be nice to merge this with EditableCanvasComponent
export class CanvasComponent extends Component<CanvasProps> {
  // @ts-ignore
  private svgRef: Ref<SVGSVGElement> = { current: undefined };

  render(props: CanvasProps) {
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

export type CanvasProps = {
  className?: string;
  diagram: Diagram;
  width?: string | number;
  height?: string | number;
  onClick?: (e: MouseEvent) => void;
};
