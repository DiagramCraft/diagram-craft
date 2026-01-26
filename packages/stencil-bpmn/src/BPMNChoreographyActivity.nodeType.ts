import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import { LayoutNode } from '@diagram-craft/canvas/layout/layoutTree';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';

type ChoreographyTaskType = 'task' | 'sub-choreography' | 'call';

export type Data = {
  type?: ChoreographyTaskType;
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

    this.capabilities.children = true;
    this.capabilities['can-have-layout'] = false;
    this.capabilities['children.select-parent'] = true;
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
    const radius = 5;
    const xr = radius / node.bounds.w;
    const yr = radius / node.bounds.h;

    return new PathListBuilder()
      .withTransform(fromUnitLCS(node.bounds))
      .moveTo(_p(xr, 0))
      .lineTo(_p(1 - xr, 0))
      .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
      .lineTo(_p(1, 1 - yr))
      .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
      .lineTo(_p(xr, 1))
      .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
      .lineTo(_p(0, yr))
      .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
      p.boolean(node, 'Expanded', 'custom.bpmnChoreographyActivity.expanded')
    ]);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
