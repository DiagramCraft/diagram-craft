import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { Anchor } from '@diagram-craft/model/anchor';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';

type BracketPosition = 'left' | 'right';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnAnnotation?: {
        bracketPosition?: BracketPosition;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnAnnotation', {
  bracketPosition: 'left'
});

// NodeDefinition and Shape *****************************************************

export class BPMNAnnotationNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnAnnotation', 'BPMN Annotation', BPMNAnnotationNodeDefinition.Shape);
  }

  getShapeAnchors(def: DiagramNode): Anchor[] {
    const bracketPosition = def.renderProps.custom.bpmnAnnotation?.bracketPosition ?? 'left';

    if (bracketPosition === 'right') {
      return [{ start: _p(1, 0.5), id: '2', type: 'point', isPrimary: true, normal: 0 }];
    } else {
      return [{ start: _p(0, 0.5), id: '4', type: 'point', isPrimary: true, normal: Math.PI }];
    }
  }

  static Shape = class extends BaseNodeComponent<BPMNAnnotationNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      const bracketPosition = props.nodeProps.custom.bpmnAnnotation?.bracketPosition ?? 'left';

      const textBox =
        bracketPosition === 'right'
          ? Box.fromCorners(
              _p(props.node.bounds.x + 5, props.node.bounds.y + 5),
              _p(
                props.node.bounds.x + props.node.bounds.w - 10,
                props.node.bounds.y + props.node.bounds.h - 5
              )
            )
          : Box.fromCorners(
              _p(props.node.bounds.x + 10, props.node.bounds.y + 5),
              _p(
                props.node.bounds.x + props.node.bounds.w - 5,
                props.node.bounds.y + props.node.bounds.h - 5
              )
            );

      shapeBuilder.text(this, '1', props.node.getText(), props.nodeProps.text, textBox);
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const bracketWidth = 0.1; // 10% of width for the bracket
    const bracketPosition = def.renderProps.custom.bpmnAnnotation?.bracketPosition ?? 'left';

    if (bracketPosition === 'right') {
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(1 - bracketWidth, 0))
        .lineTo(_p(1, 0))
        .lineTo(_p(1, 1))
        .lineTo(_p(1 - bracketWidth, 1));
    } else {
      return new PathListBuilder()
        .withTransform(fromUnitLCS(def.bounds))
        .moveTo(_p(bracketWidth, 0))
        .lineTo(_p(0, 0))
        .lineTo(_p(0, 1))
        .lineTo(_p(bracketWidth, 1));
    }
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return [
      {
        id: 'bracketPosition',
        type: 'select',
        label: 'Bracket Position',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' }
        ],
        value: def.renderProps.custom.bpmnAnnotation?.bracketPosition ?? 'left',
        isSet: def.storedProps.custom?.bpmnAnnotation?.bracketPosition !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps(
              'bpmnAnnotation',
              props => (props.bracketPosition = undefined),
              uow
            );
          } else {
            def.updateCustomProps(
              'bpmnAnnotation',
              props => (props.bracketPosition = value as BracketPosition),
              uow
            );
          }
        }
      }
    ];
  }
}
