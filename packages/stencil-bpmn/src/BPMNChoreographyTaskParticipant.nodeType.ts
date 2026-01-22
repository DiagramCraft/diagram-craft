import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import {
  CustomProperty,
  CustomPropertyDefinition
} from '@diagram-craft/model/elementDefinitionRegistry';
import { Box } from '@diagram-craft/geometry/box';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import squarePlusIcon from './icons/square-plus.svg?raw';
import linesVerticalIcon from './icons/lines-vertical.svg?raw';
import linesHorizontalIcon from './icons/lines-horizontal.svg?raw';
import arrowBackUpIcon from './icons/arrow-back-up.svg?raw';

type ParticipantPosition = 'top' | 'middle' | 'bottom';
type LoopType = 'none' | 'standard' | 'sequential' | 'parallel';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnChoreographyTaskParticipant?: {
        position?: ParticipantPosition;
        initiating?: boolean;
        loopType?: LoopType;
        multiple?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnChoreographyTaskParticipant', {
  position: 'top',
  initiating: false,
  loopType: 'none',
  multiple: false
});

// NodeDefinition and Shape *****************************************************

const ICON_MARGIN = 2;
const ICON_SIZE = 15;
const BOTTOM_MARGIN = 2;

export class BPMNChoreographyTaskParticipantNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyTaskParticipant',
      'BPMN Choreography Task Participant',
      BPMNChoreographyTaskParticipantNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyTaskParticipantNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());

      builder.text(
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

      const markers: Icon[] = [];

      const participantProps = props.nodeProps.custom.bpmnChoreographyTaskParticipant;
      const parentProps = (props.node.parent as DiagramNode | undefined)?.renderProps.custom
        .bpmnChoreographyTask;

      if (participantProps.position === 'middle') {
        if (!parentProps?.expanded) {
          if (participantProps.loopType === 'parallel') {
            markers.push(getSVGIcon(linesVerticalIcon));
          } else if (participantProps.loopType === 'sequential') {
            markers.push(getSVGIcon(linesHorizontalIcon));
          } else if (participantProps.loopType === 'standard') {
            markers.push(getSVGIcon(arrowBackUpIcon));
          }
        }

        if (parentProps?.type === 'sub-choreography') {
          markers.push(getSVGIcon(squarePlusIcon));
        }
      } else {
        if (participantProps.multiple) {
          markers.push(getSVGIcon(linesVerticalIcon));
        }
      }

      if (markers.length > 0) {
        const width = markers.length * ICON_SIZE + (markers.length - 1) * ICON_MARGIN;
        const centerX = props.node.bounds.x + props.node.bounds.w / 2;

        let x = centerX - width / 2;
        for (const marker of markers) {
          const position = Box.fromCorners(
            _p(x, props.node.bounds.y + props.node.bounds.h - ICON_SIZE - BOTTOM_MARGIN),
            _p(x + ICON_SIZE, props.node.bounds.y + props.node.bounds.h - BOTTOM_MARGIN)
          );
          this.renderIcon(marker, position, props.nodeProps, builder);
          x += ICON_SIZE + ICON_MARGIN;
        }
      }
    }

    private renderIcon(
      icon: Icon,
      position: Box,
      nodeProps: NodePropsForRendering,
      shapeBuilder: ShapeBuilder
    ) {
      shapeBuilder.path(
        PathListBuilder.fromPathList(icon.pathList)
          .getPaths(TransformFactory.fromTo(icon.viewbox, position))
          .all(),
        undefined,
        {
          style: {
            fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
            stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none',
            strokeWidth: '1',
            strokeDasharray: 'none'
          }
        }
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

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return [
      CustomProperty.node.select(
        def,
        'Position',
        'custom.bpmnChoreographyTaskParticipant.position',
        [
          { value: 'top', label: 'Top' },
          { value: 'middle', label: 'Middle' },
          { value: 'bottom', label: 'Bottom' }
        ]
      ),
      CustomProperty.node.boolean(
        def,
        'Initiating',
        'custom.bpmnChoreographyTaskParticipant.initiating'
      ),
      CustomProperty.node.select(
        def,
        'Loop Type',
        'custom.bpmnChoreographyTaskParticipant.loopType',
        [
          { value: 'none', label: 'None' },
          { value: 'standard', label: 'Standard' },
          { value: 'sequential', label: 'Sequential' },
          { value: 'parallel', label: 'Parallel' }
        ]
      ),
      CustomProperty.node.boolean(
        def,
        'Multiple',
        'custom.bpmnChoreographyTaskParticipant.multiple'
      )
    ];
  }
}
