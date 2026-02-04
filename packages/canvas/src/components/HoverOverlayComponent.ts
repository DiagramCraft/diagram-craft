import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, Observable, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { ShapeNodeDefinition } from '../shape/shapeNodeDefinition';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';

type Props = CanvasState & {
  hoverElement: Observable<string | undefined>;
};

export class HoverOverlayComponent extends Component<Props> {
  render(props: Props) {
    onEvent(props.hoverElement, 'change', () => {
      this.redraw();
    });

    if (props.hoverElement.get() === undefined) return svg.g({});

    const hoverElement = props.diagram.lookup(props.hoverElement.get()!);
    if (!hoverElement) return svg.g({});

    const node = hoverElement as DiagramNode;
    if (isEdge(node)) return svg.g({});

    const overlayMatch = this.getOverlayComponent(node);
    if (!overlayMatch) return svg.g({});

    const nodeComponent = new overlayMatch.cmp();

    const overlay = this.subComponent(() => nodeComponent, { node: overlayMatch.node });
    if (!overlay) return svg.g({});

    const transform = `${Transforms.rotate(node.bounds)} ${node.renderProps.geometry.flipH ? Transforms.flipH(node.bounds) : ''} ${node.renderProps.geometry.flipV ? Transforms.flipV(node.bounds) : ''}`;
    return svg.g({ transform: transform.trim() }, overlay);
  }

  getOverlayComponent(
    node: DiagramNode
  ): { node: DiagramNode; cmp: { new (): Component<{ node: DiagramNode }> } } | undefined {
    const def = node.getDefinition() as ShapeNodeDefinition;
    if (def.overlayComponent) return { node, cmp: def.overlayComponent };
    else if (node.parent) return this.getOverlayComponent(node.parent as DiagramNode);
    else return undefined;
  }
}
