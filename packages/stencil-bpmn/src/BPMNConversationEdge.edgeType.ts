import { Path } from '@diagram-craft/geometry/path';
import { BaseEdgeComponent } from '@diagram-craft/canvas/components/BaseEdgeComponent';
import { DeepReadonly, DeepRequired } from '@diagram-craft/utils/types';
import { ShapeEdgeDefinition } from '@diagram-craft/canvas/shape/shapeEdgeDefinition';
import { DiagramEdge, EdgePropsForRendering } from '@diagram-craft/model/diagramEdge';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { ArrowShape } from '@diagram-craft/canvas/arrowShapes';
import { EdgeFlag, EdgeFlags } from '@diagram-craft/model/edgeDefinition';
import type { EdgeProps } from '@diagram-craft/model/diagramProps';
import { deepMerge } from '@diagram-craft/utils/object';

// EdgeDefinition and Shape *****************************************************

export class BPMNConversationEdgeDefinition extends ShapeEdgeDefinition {
  constructor() {
    super('BPMN Conversation Edge', 'bpmnConversationEdge', BPMNConversationEdgeDefinition.Shape);
  }

  static Shape = class extends BaseEdgeComponent {
    buildShape(
      path: Path,
      shapeBuilder: ShapeBuilder,
      _edge: DiagramEdge,
      props: EdgePropsForRendering
    ) {
      const width = 5;

      const offset1 = path.offset(width / 2);
      const offset2 = path.offset(-width / 2);

      const d = deepMerge({}, props, {
        // @ts-ignore
        fill: {
          color: 'transparent'
        }
      });
      shapeBuilder.edge([offset1, offset2], d);
    }

    // Note: Override getArrow to return undefined to disable arrows
    protected getArrow(
      _type: 'start' | 'end',
      _edgeProps: DeepReadonly<DeepRequired<EdgeProps>>
    ): ArrowShape | undefined {
      return undefined;
    }
  };

  hasFlag(flag: EdgeFlag): boolean {
    return ![EdgeFlags.StyleArrows, EdgeFlags.StyleLineHops].includes(flag);
  }
}
