import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import { LayoutNode } from '@diagram-craft/canvas/layout/layoutTree';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { roundedRectOutline } from '@diagram-craft/stencil-bpmn/utils';

type ChoreographyTaskType = 'task' | 'sub-choreography' | 'call';

type LoopType = 'none' | 'standard' | 'sequential' | 'parallel';

export type Data = {
  type?: ChoreographyTaskType;
  loopType?: LoopType;
};

const SCHEMA: DataSchema = {
  id: 'bpmnChoreographyActivity',
  name: 'BPMN Choreography Activity',
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
        { value: 'task', label: 'Task' },
        { value: 'sub-choreography', label: 'Sub-Choreography' },
        { value: 'call', label: 'Call' }
      ]
    },
    {
      id: 'loopType',
      name: 'Loop Type',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Standard', value: 'standard' },
        { label: 'Sequential', value: 'sequential' },
        { label: 'Parallel', value: 'parallel' }
      ]
    }
  ]
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnChoreographyActivity?: { expanded?: boolean };
    }
  }
}

registerCustomNodeDefaults('bpmnChoreographyActivity', {
  expanded: false
});

export class BPMNChoreographyActivityNodeDefinition extends LayoutCapableShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyActivity',
      'BPMN Choreography Activity',
      BPMNChoreographyActivityNodeDefinition.Shape
    );

    this.setFlags({
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCanHaveLayout]: false,
      [NodeFlags.ChildrenSelectParent]: true
    });
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyActivityNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnChoreographyActivity');
      return { ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      super.buildShape(props, builder);

      props.node.children.forEach(child => {
        builder.add(
          svg.g(
            { transform: Transforms.rotateBack(props.node.bounds) },
            renderElement(this, child, props)
          )
        );
      });
    }

    protected adjustStyle(
      node: DiagramNode,
      _nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const data = this.getData(node);
      if (data.type === 'call') {
        style.strokeWidth = '3';
        style.paintOrder = 'stroke';
      }
    }
  };

  protected prepareLayoutTree(layoutRoot: DiagramNode): LayoutNode {
    const layoutTree = super.prepareLayoutTree(layoutRoot);

    layoutTree.containerInstructions = {
      direction: 'vertical',
      gap: 0,
      justifyContent: 'start',
      alignItems: 'stretch',
      enabled: true,
      autoShrink: true
    };

    return layoutTree;
  }

  getBoundingPathBuilder(node: DiagramNode): PathListBuilder {
    return roundedRectOutline(node.bounds, 5);
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
      p.boolean(node, 'Expanded', 'custom.bpmnChoreographyActivity.expanded')
    ]);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
