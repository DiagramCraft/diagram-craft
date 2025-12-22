import type { CanvasState } from '../canvas/EditableCanvasComponent';
import { Component, Observable, onEvent } from '../component/component';
import * as svg from '../component/vdom-svg';
import { Transforms } from '../component/vdom-svg';
import { mustExist } from '@diagram-craft/utils/assert';
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

    const node = mustExist(props.diagram.lookup(props.hoverElement.get()!)) as DiagramNode;
    if (isEdge(node)) return svg.g({});

    const nodeDefinition = props.diagram.document.nodeDefinitions.get(node.nodeType);
    const shapeNodeDefinition = nodeDefinition as ShapeNodeDefinition;

    if (!shapeNodeDefinition.overlayComponent) return svg.g({});

    const nodeComponent = new shapeNodeDefinition.overlayComponent();
    const overlay = this.subComponent(() => nodeComponent, { node });

    if (!overlay) return svg.g({});

    const transform = `${Transforms.rotate(node.bounds)} ${node.renderProps.geometry.flipH ? Transforms.flipH(node.bounds) : ''} ${node.renderProps.geometry.flipV ? Transforms.flipV(node.bounds) : ''}`;
    return svg.g({ transform: transform.trim() }, overlay);
  }
}
