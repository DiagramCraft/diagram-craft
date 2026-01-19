import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnTask?: {
        radius?: number;
        loopType?: 'none' | 'standard' | 'sequential' | 'parallel';
      };
    }
  }
}

registerCustomNodeDefaults('bpmnTask', {
  radius: 5,
  loopType: 'none'
});

export class BPMNTaskNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnTask', 'BPMN Task', BPMNTaskNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNTaskNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      shapeBuilder.boundaryPath(
        new BPMNTaskNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      const loopType = node.renderProps.custom.bpmnTask.loopType ?? 'none';
      if (loopType !== 'none') {
        this.buildLoopIndicator(node, loopType, shapeBuilder);
      }

      shapeBuilder.text(this);
    }

    private buildLoopIndicator(
      node: DiagramNode,
      loopType: 'standard' | 'sequential' | 'parallel',
      shapeBuilder: ShapeBuilder
    ) {
      const bounds = node.bounds;
      const size = 12; // Size of the loop indicator
      const centerX = bounds.x + bounds.w / 2;
      const bottomY = bounds.y + bounds.h - size - 5; // 5px from bottom

      if (loopType === 'standard') {
        // Standard loop: circular arrow
        const cx = centerX;
        const cy = bottomY + size / 2;
        const r = size / 2;

        const pathBuilder = new PathListBuilder()
          .moveTo(_p(cx - r, cy))
          .arcTo(_p(cx, cy - r), r, r, 0, 0, 1)
          .arcTo(_p(cx + r, cy), r, r, 0, 0, 1)
          .arcTo(_p(cx, cy + r), r, r, 0, 0, 1);

        // Add arrow head
        pathBuilder
          .moveTo(_p(cx - r, cy))
          .lineTo(_p(cx - r - 2, cy - 2.5))
          .moveTo(_p(cx - r, cy))
          .lineTo(_p(cx - r + 3, cy - 2.5));

        shapeBuilder.path(pathBuilder.getPaths().all());
      } else if (loopType === 'sequential') {
        // Sequential: three horizontal lines
        const lineWidth = size;
        const lineSpacing = size / 4;
        const startX = centerX - lineWidth / 2;
        const startY = bottomY + size / 2 - lineSpacing;

        const pathBuilder = new PathListBuilder()
          .moveTo(_p(startX, startY))
          .lineTo(_p(startX + lineWidth, startY))
          .moveTo(_p(startX, startY + lineSpacing))
          .lineTo(_p(startX + lineWidth, startY + lineSpacing))
          .moveTo(_p(startX, startY + lineSpacing * 2))
          .lineTo(_p(startX + lineWidth, startY + lineSpacing * 2));

        shapeBuilder.path(pathBuilder.getPaths().all());
      } else if (loopType === 'parallel') {
        // Parallel: three vertical lines
        const lineHeight = size;
        const lineSpacing = size / 4;
        const startX = centerX - lineSpacing;
        const startY = bottomY;

        const pathBuilder = new PathListBuilder()
          .moveTo(_p(startX, startY))
          .lineTo(_p(startX, startY + lineHeight))
          .moveTo(_p(startX + lineSpacing, startY))
          .lineTo(_p(startX + lineSpacing, startY + lineHeight))
          .moveTo(_p(startX + lineSpacing * 2, startY))
          .lineTo(_p(startX + lineSpacing * 2, startY + lineHeight));

        shapeBuilder.path(pathBuilder.getPaths().all());
      }
    }
  };

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return [
      { id: '1', start: _p(0.5, 1), type: 'point', isPrimary: true, normal: Math.PI / 2 },
      { id: '2', start: _p(0.5, 0), type: 'point', isPrimary: true, normal: -Math.PI / 2 },
      { id: '3', start: _p(1, 0.5), type: 'point', isPrimary: true, normal: 0 },
      { id: '4', start: _p(0, 0.5), type: 'point', isPrimary: true, normal: Math.PI },
      { id: 'c', start: _p(0.5, 0.5), clip: true, type: 'center' }
    ];
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'radius',
        type: 'number',
        label: 'Radius',
        value: def.renderProps.custom.bpmnTask.radius,
        maxValue: 60,
        unit: 'px',
        isSet: def.storedProps.custom?.bpmnTask?.radius !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.radius = undefined), uow);
          } else {
            if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;

            def.updateCustomProps('bpmnTask', props => (props.radius = value), uow);
          }
        }
      },
      {
        id: 'loopType',
        type: 'select',
        label: 'Loop Type',
        value: def.renderProps.custom.bpmnTask.loopType ?? 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Standard Loop', value: 'standard' },
          { label: 'Sequential Multi-Instance', value: 'sequential' },
          { label: 'Parallel Multi-Instance', value: 'parallel' }
        ],
        isSet: def.storedProps.custom?.bpmnTask?.loopType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.loopType = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnTask',
              props => (props.loopType = value as 'none' | 'standard' | 'sequential' | 'parallel'),
              uow
            );
          }
        }
      }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const radius = node.renderProps.custom.bpmnTask.radius;
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
}
