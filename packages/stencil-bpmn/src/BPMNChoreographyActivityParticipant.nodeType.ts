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
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { getIcon, Markers, renderMarkers } from '@diagram-craft/stencil-bpmn/utils';
import { linesVerticalIcon } from './icons/icons';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { ICON_SIZE } from '@diagram-craft/stencil-bpmn/spacing';

type ParticipantPosition = 'top' | 'bottom';

type Data = {
  initiating?: boolean;
  multiple?: boolean;
};

const SCHEMA: DataSchema = {
  id: 'bpmnChoreographyActivityParticipant',
  name: 'BPMN Choreography Participant',
  providerId: 'default',
  fields: [
    {
      id: 'initiating',
      name: 'Initiating',
      type: 'boolean'
    },
    {
      id: 'multiple',
      name: 'Multiple',
      type: 'boolean'
    }
  ]
};

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnChoreographyActivityParticipant?: {
        position?: ParticipantPosition;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnChoreographyActivityParticipant', {
  position: 'top'
});

// NodeDefinition and Shape *****************************************************

const ICON_MARGIN = 2;
const BOTTOM_MARGIN = 2;

export class BPMNChoreographyActivityParticipantNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super(
      'bpmnChoreographyActivityParticipant',
      'BPMN Choreography Participant',
      BPMNChoreographyActivityParticipantNodeDefinition.Shape
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNChoreographyActivityParticipantNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(
        e => e.schema === 'bpmnChoreographyActivityParticipant'
      );
      return { ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      builder.boundaryPath(this.def.getBoundingPathBuilder(props.node).getPaths().all());
      builder.text(this);

      const data = this.getData(props.node);
      const markers: Markers = { left: [], center: [], right: [] };

      if (data.multiple) {
        markers.center.push(getIcon(linesVerticalIcon));
      }

      renderMarkers(props.node, markers, builder, {
        size: ICON_SIZE,
        bottomMargin: BOTTOM_MARGIN,
        spacing: ICON_MARGIN
      });
    }
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const position = def.renderProps.custom.bpmnChoreographyActivityParticipant?.position ?? 'top';
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
    } else {
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
    }
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
      p.select(node, 'Position', 'custom.bpmnChoreographyActivityParticipant.position', [
        { value: 'top', label: 'Top' },
        { value: 'bottom', label: 'Bottom' }
      ])
    ]);
    def.dataSchemas = [SCHEMA];
    return def;
  }
}
