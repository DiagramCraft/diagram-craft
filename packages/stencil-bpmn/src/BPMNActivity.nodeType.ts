import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import {
  arrowBackUpIcon,
  handFingerRightIcon,
  linesHorizontalIcon,
  linesVerticalIcon,
  mailFilledIcon,
  mailIcon,
  playerTrackPrevIcon,
  scriptIcon,
  settingsIcon,
  squarePlusIcon,
  tableIcon,
  tildeIcon,
  userIcon
} from './icons/icons';
import {
  getIcon,
  Markers,
  RECTANGULAR_SHAPE_ANCHORS,
  renderIcon,
  renderMarkers,
  roundedRectOutline
} from '@diagram-craft/stencil-bpmn/utils';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { DiagramElement } from '@diagram-craft/model/diagramElement';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Transforms } from '@diagram-craft/canvas/component/vdom-svg';
import { renderElement } from '@diagram-craft/canvas/components/renderElement';
import {
  BOTTOM_MARGIN,
  ICON_MARGIN,
  ICON_SIZE,
  MARKER_SIZE,
  MARKER_SPACING
} from '@diagram-craft/stencil-bpmn/spacing';

type SubprocessType =
  | 'default'
  | 'loop'
  | 'multi-instance'
  | 'compensation'
  | 'ad-hoc'
  | 'compensation-and-ad-hoc';

const TASK_TYPE_ICONS: Record<string, string> = {
  'service': settingsIcon,
  'send': mailFilledIcon,
  'receive': mailIcon,
  'user': userIcon,
  'manual': handFingerRightIcon,
  'business-rule': tableIcon,
  'script': scriptIcon
};

const TRANSACTION_OFFSET = 3;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnActivity?: {
        radius?: number;
        expanded?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnActivity', {
  radius: 5,
  expanded: false
});

type Data = {
  taskType?: string;
  activityType?: string;
  loop?: boolean;
  multiInstance?: 'none' | 'sequential' | 'parallel';
  compensation?: boolean;
  subprocessType?: SubprocessType;
};

const SCHEMA: DataSchema = {
  id: 'bpmnActivity',
  name: 'BPMN Activity',
  providerId: 'default',
  fields: [
    {
      id: 'name',
      name: 'Name',
      type: 'text'
    },
    {
      id: 'activityType',
      name: 'Type',
      type: 'select',
      options: [
        { value: 'task', label: 'Task' },
        { value: 'sub-process', label: 'Sub-process' },
        { value: 'event-sub-process', label: 'Event sub-process' },
        { value: 'transaction', label: 'Transaction' },
        { value: 'call-activity', label: 'Call activity' },
        { value: 'call-activity-sub-process', label: 'Call activity sub-process' }
      ]
    },
    {
      id: 'taskType',
      name: 'Task Type',
      type: 'select',
      options: [
        { value: 'regular', label: 'Regular' },
        { value: 'service', label: 'Service' },
        { value: 'send', label: 'Send' },
        { value: 'receive', label: 'Receive' },
        { value: 'user', label: 'User' },
        { value: 'manual', label: 'Manual' },
        { value: 'business-rule', label: 'Business Rule' },
        { value: 'script', label: 'Script' }
      ]
    },
    {
      id: 'loop',
      name: 'Loop',
      type: 'boolean'
    },
    {
      id: 'multiInstance',
      name: 'Multi-Instance',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'Sequential', value: 'sequential' },
        { label: 'Parallel', value: 'parallel' }
      ]
    },
    {
      id: 'compensation',
      name: 'Compensation',
      type: 'boolean'
    },
    {
      id: 'subprocessType',
      name: 'Subprocess Type',
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Loop', value: 'loop' },
        { label: 'Multi-Instance', value: 'multi-instance' },
        { label: 'Compensation', value: 'compensation' },
        { label: 'Ad-Hoc', value: 'ad-hoc' },
        { label: 'Compensation and Ad-Hoc', value: 'compensation-and-ad-hoc' }
      ]
    }
  ]
};

export class BPMNActivityNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnActivity', 'BPMN Activity', BPMNActivityNodeDefinition.Shape);
    this.setFlags({ [NodeFlags.ChildrenAllowed]: true });
  }

  onDrop(
    _coord: Point,
    node: DiagramNode,
    elements: ReadonlyArray<DiagramElement>,
    uow: UnitOfWork,
    _operation: string
  ): void {
    node.diagram.moveElement(elements, uow, node.layer, { relation: 'on', element: node });
  }

  // We don't want to change children if resizing activity
  onTransform(): void {}

  private static isSubprocessActivity(activityType: string): boolean {
    return (
      activityType === 'sub-process' ||
      activityType === 'event-sub-process' ||
      activityType === 'transaction' ||
      activityType === 'call-activity-sub-process'
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNActivityNodeDefinition> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnActivity');
      return { ...(data?.data ?? {}) } as Data;
    }

    protected adjustStyle(
      node: DiagramNode,
      _nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      const data = this.getData(node);
      if (
        data.activityType === 'event-sub-process' &&
        node.getPropsInfo('stroke.pattern')!.at(-1)!.type === 'default'
      ) {
        style.strokeDasharray = '2 5';
      }

      if (data.activityType === 'transaction') {
        style.strokeWidth = '1.5';
      }

      if (data.activityType?.startsWith('call-activity')) {
        style.strokeWidth = '3';
      }
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      shapeBuilder.boundaryPath(
        new BPMNActivityNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      const data = this.getData(props.node);
      const activityType = data.activityType ?? 'task';

      const markers: Markers = { left: [], center: [], right: [] };
      if (BPMNActivityNodeDefinition.isSubprocessActivity(activityType)) {
        if (!props.nodeProps.custom.bpmnActivity.expanded)
          markers.center.push(getIcon(squarePlusIcon));

        if (data.subprocessType === 'loop') markers.left.push(getIcon(arrowBackUpIcon));
        else if (data.subprocessType === 'compensation')
          markers.left.push(getIcon(playerTrackPrevIcon));
        else if (data.subprocessType === 'ad-hoc') markers.right.push(getIcon(tildeIcon));
        else if (data.subprocessType === 'compensation-and-ad-hoc') {
          markers.left.push(getIcon(playerTrackPrevIcon));
          markers.right.push(getIcon(tildeIcon));
        } else if (data.subprocessType === 'multi-instance')
          markers.left.push(getIcon(linesVerticalIcon));

        if (props.nodeProps.custom.bpmnActivity.expanded) {
          markers.left.forEach(m => markers.center.push(m));
          markers.right.forEach(m => markers.center.push(m));
          markers.left.splice(0, markers.left.length);
          markers.right.splice(0, markers.right.length);
        }
      } else {
        // Use individual marker properties for regular tasks
        if (data.loop) markers.center.push(getIcon(arrowBackUpIcon));
        if (data.multiInstance === 'sequential') markers.center.push(getIcon(linesHorizontalIcon));
        if (data.multiInstance === 'parallel') markers.center.push(getIcon(linesVerticalIcon));
        if (data.compensation) markers.center.push(getIcon(playerTrackPrevIcon));
      }

      renderMarkers(node, markers, shapeBuilder, {
        size: MARKER_SIZE,
        spacing: MARKER_SPACING,
        bottomMargin: BOTTOM_MARGIN
      });

      if (activityType === 'transaction') {
        shapeBuilder.path(
          roundedRectOutline(
            Box.grow(node.bounds, -TRANSACTION_OFFSET),
            props.nodeProps.custom.bpmnActivity.radius - TRANSACTION_OFFSET
          )
            .getPaths()
            .all(),
          undefined,
          {
            style: { fill: 'none' }
          }
        );
      }

      const taskType = data.taskType;
      const iconSvg = taskType ? TASK_TYPE_ICONS[taskType] : undefined;

      if (iconSvg) {
        const icon = getIcon(iconSvg);

        const dest = Box.fromCorners(
          _p(node.bounds.x + ICON_MARGIN, node.bounds.y + ICON_MARGIN),
          _p(node.bounds.x + ICON_MARGIN + ICON_SIZE, node.bounds.y + ICON_MARGIN + ICON_SIZE)
        );
        renderIcon(icon, dest, props.nodeProps, shapeBuilder);
      }

      shapeBuilder.text(this);

      shapeBuilder.add(
        svg.g(
          {},
          ...props.node.children.map(child =>
            svg.g(
              { transform: Transforms.rotateBack(props.node.bounds) },
              renderElement(this, child, props)
            )
          )
        )
      );
    }
  };

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return RECTANGULAR_SHAPE_ANCHORS;
  }

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
      p.boolean(node, 'Expanded', 'custom.bpmnActivity.expanded'),
      p.number(node, 'Radius', 'custom.bpmnActivity.radius', {
        maxValue: 60,
        unit: 'px',
        set: (value: number | undefined, uow: UnitOfWork) => {
          if (value !== undefined && (value >= node.bounds.w / 2 || value >= node.bounds.h / 2)) {
            return;
          }
          node.updateCustomProps('bpmnActivity', props => (props.radius = value), uow);
        }
      })
    ]);
    def.dataSchemas = [SCHEMA];
    return def;
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return roundedRectOutline(node.bounds, node.renderProps.custom.bpmnActivity.radius);
  }
}
