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
import { squarePlusIcon } from './icons/icons';
import { getSVGIcon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { renderIcon } from '@diagram-craft/stencil-bpmn/utils';
import { ICON_SIZE } from '@diagram-craft/stencil-bpmn/spacing';

type ConversationType =
  | 'conversation'
  | 'sub-conversation'
  | 'call-conversation'
  | 'call-conversation-collaboration';

type Data = {
  type?: ConversationType;
};

const SCHEMA: DataSchema = {
  id: 'bpmnConversation',
  name: 'BPMN Conversation',
  providerId: 'default',
  fields: [
    {
      id: 'name',
      name: 'Name',
      type: 'text'
    },
    {
      id: 'type',
      name: 'Type',
      type: 'select',
      options: [
        { value: 'conversation', label: 'Conversation' },
        { value: 'sub-conversation', label: 'Sub-conversation' },
        { value: 'call-conversation', label: 'Call-conversation' },
        { value: 'call-conversation-collaboration', label: 'Call-conversation Collaboration' }
      ]
    }
  ]
};

// NodeDefinition and Shape *****************************************************

export class BPMNConversationNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnConversation', 'BPMN Conversation', BPMNConversationNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNConversationNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnConversation');
      return { type: 'conversation', ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const bounds = props.node.bounds;

      shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(bounds.x - 50, bounds.y + bounds.h + 10),
          _p(bounds.x + bounds.w + 50, bounds.y + bounds.h + 20)
        )
      );

      const data = this.getData(props.node);
      if (data.type === 'sub-conversation' || data.type === 'call-conversation-collaboration') {
        const icon = getSVGIcon(squarePlusIcon);

        const centerX = bounds.x + bounds.w / 2;
        const margin = 1.5;
        const position = Box.fromCorners(
          _p(centerX - ICON_SIZE / 2, bounds.y + bounds.h - ICON_SIZE - margin),
          _p(centerX + ICON_SIZE / 2, bounds.y + bounds.h - margin)
        );

        renderIcon(icon, position, props.nodeProps, shapeBuilder);
      }
    }

    protected adjustStyle(
      node: DiagramNode,
      _nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const data = this.getData(node);
      if (data.type?.startsWith('call-conversation')) {
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

  getCustomPropertyDefinitions(_node: DiagramNode) {
    const def = new CustomPropertyDefinition();
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
