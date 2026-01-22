import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import squarePlusIcon from './icons/square-plus.svg?raw';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { getSVGIcon } from '@diagram-craft/stencil-bpmn/svgIcon';

type ConversationType =
  | 'conversation'
  | 'sub-conversation'
  | 'call-conversation'
  | 'call-conversation-collaboration';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnConversation?: {
        type?: ConversationType;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnConversation', {
  type: 'conversation'
});

// NodeDefinition and Shape *****************************************************

export class BPMNConversationNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnConversation', 'BPMN Conversation', BPMNConversationNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNConversationNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(props.node.bounds.x - 50, props.node.bounds.y + props.node.bounds.h + 10),
          _p(
            props.node.bounds.x + props.node.bounds.w + 50,
            props.node.bounds.y + props.node.bounds.h + 20
          )
        )
      );

      const type = props.nodeProps.custom.bpmnConversation.type;
      if (type === 'sub-conversation' || type === 'call-conversation-collaboration') {
        const icon = getSVGIcon(squarePlusIcon);

        const centerX = props.node.bounds.x + props.node.bounds.w / 2;
        const iconSize = 15;
        const margin = 1.5;
        const position = Box.fromCorners(
          _p(centerX - iconSize / 2, props.node.bounds.y + props.node.bounds.h - iconSize - margin),
          _p(centerX + iconSize / 2, props.node.bounds.y + props.node.bounds.h - margin)
        );
        shapeBuilder.path(
          PathListBuilder.fromPathList(icon.pathList)
            .getPaths(TransformFactory.fromTo(icon.viewbox, position))
            .all(),
          undefined,
          {
            style: {
              strokeWidth: '1'
            }
          }
        );
      }
    }

    protected adjustStyle(
      _element: DiagramNode,
      nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      if (nodeProps.custom.bpmnConversation.type.startsWith('call-conversation')) {
        style.strokeWidth = '3';
      }
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const x1 = 0.25;
    const x2 = 1 - 0.25;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(def.bounds))
      .moveTo(_p(x1, 0))
      .lineTo(_p(x2, 0))
      .lineTo(_p(1, 0.5))
      .lineTo(_p(x2, 1))
      .lineTo(_p(x1, 1))
      .lineTo(_p(0, 0.5))
      .close();
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.select(def, 'Type', 'custom.bpmnConversation.type', [
        { value: 'conversation', label: 'Conversation' },
        { value: 'sub-conversation', label: 'Sub-conversation' },
        { value: 'call-conversation', label: 'Call-conversation' },
        { value: 'call-conversation-collaboration', label: 'Call-conversation Collaboration' }
      ])
    ]);
  }
}
