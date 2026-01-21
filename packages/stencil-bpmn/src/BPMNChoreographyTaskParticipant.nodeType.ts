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
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

type ParticipantPosition = 'top' | 'middle' | 'bottom';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnChoreographyTaskParticipant?: {
        position?: ParticipantPosition;
        initiating?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnChoreographyTaskParticipant', {
  position: 'top',
  initiating: false
});

// NodeDefinition and Shape *****************************************************

export class BPMNChoreographyTaskParticipantNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyTaskParticipant',
      'BPMN Choreography Task Participant',
      BPMNChoreographyTaskParticipantNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyTaskParticipantNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(props.node.bounds.x + 5, props.node.bounds.y + 5),
          _p(
            props.node.bounds.x + props.node.bounds.w - 5,
            props.node.bounds.y + props.node.bounds.h - 5
          )
        )
      );
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const position = def.renderProps.custom.bpmnChoreographyTaskParticipant?.position ?? 'top';
    const radius = 5;
    const xr = radius / def.bounds.w;
    const yr = radius / def.bounds.h;

    if (position === 'top') {
      // Round top two corners only
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(xr, 0))
        .lineTo(_p(1 - xr, 0))
        .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
        .lineTo(_p(1, 1))
        .lineTo(_p(0, 1))
        .lineTo(_p(0, yr))
        .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
    } else if (position === 'bottom') {
      // Round bottom two corners only
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(0, 0))
        .lineTo(_p(1, 0))
        .lineTo(_p(1, 1 - yr))
        .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
        .lineTo(_p(xr, 1))
        .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
        .lineTo(_p(0, 0))
        .close();
    } else {
      // Middle position - no rounded corners
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(0, 0))
        .lineTo(_p(1, 0))
        .lineTo(_p(1, 1))
        .lineTo(_p(0, 1))
        .close();
    }
  }

  getCustomPropertyDefinitions(def: DiagramNode): Array<CustomPropertyDefinition> {
    return [
      {
        id: 'position',
        type: 'select',
        label: 'Position',
        options: [
          { value: 'top', label: 'Top' },
          { value: 'middle', label: 'Middle' },
          { value: 'bottom', label: 'Bottom' }
        ],
        value: def.renderProps.custom.bpmnChoreographyTaskParticipant?.position ?? 'top',
        isSet: def.storedProps.custom?.bpmnChoreographyTaskParticipant?.position !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps(
              'bpmnChoreographyTaskParticipant',
              props => (props.position = undefined),
              uow
            );
          } else {
            def.updateCustomProps(
              'bpmnChoreographyTaskParticipant',
              props => (props.position = value as ParticipantPosition),
              uow
            );
          }
        }
      },
      {
        id: 'initiating',
        type: 'boolean',
        label: 'Initiating',
        value: def.renderProps.custom.bpmnChoreographyTaskParticipant?.initiating ?? false,
        isSet: def.storedProps.custom?.bpmnChoreographyTaskParticipant?.initiating !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps(
              'bpmnChoreographyTaskParticipant',
              props => (props.initiating = undefined),
              uow
            );
          } else {
            def.updateCustomProps(
              'bpmnChoreographyTaskParticipant',
              props => (props.initiating = value),
              uow
            );
          }
        }
      }
    ];
  }
}
