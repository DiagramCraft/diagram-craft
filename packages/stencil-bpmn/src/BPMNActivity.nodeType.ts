import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { fromUnitLCS, PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import { Anchor } from '@diagram-craft/model/anchor';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import settingsIcon from './icons/settings.svg?raw';
import mailFilledIcon from './icons/mail-filled.svg?raw';
import mailIcon from './icons/mail.svg?raw';
import userIcon from './icons/user.svg?raw';
import tableIcon from './icons/table.svg?raw';
import scriptIcon from './icons/script.svg?raw';
import squarePlusIcon from './icons/square-plus.svg?raw';
import arrowBackUpIcon from './icons/arrow-back-up.svg?raw';
import handFingerRightIcon from './icons/hand-finger-right.svg?raw';
import playerTrackPrevIcon from './icons/player-track-prev.svg?raw';
import tildeIcon from './icons/tilde.svg?raw';
import linesVerticalIcon from './icons/lines-vertical.svg?raw';
import linesHorizontalIcon from './icons/lines-horizontal.svg?raw';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';

type SubprocessType =
  | 'default'
  | 'loop'
  | 'multi-instance'
  | 'compensation'
  | 'ad-hoc'
  | 'compensation-and-ad-hoc';

type MarkerType = 'loop' | 'sequential' | 'parallel' | 'compensation' | 'ad-hoc' | 'subprocess';

const TASK_TYPE_ICONS: Record<string, string> = {
  'service': settingsIcon,
  'send': mailFilledIcon,
  'receive': mailIcon,
  'user': userIcon,
  'manual': handFingerRightIcon,
  'business-rule': tableIcon,
  'script': scriptIcon
};

const ICON_MARGIN = 5;
const ICON_SIZE = 15;
const MARKER_SIZE = 12;
const MARKER_SPACING = 4;
const BOTTOM_MARGIN = 5;
const TRANSACTION_OFFSET = 3;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnActivity?: {
        radius?: number;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnActivity', {
  radius: 5
});

type Data = {
  taskType?: string;
  activityType?: string;
  loop?: boolean;
  multiInstance?: 'none' | 'sequential' | 'parallel';
  compensation?: boolean;
  subprocessType?: SubprocessType;
  expanded?: boolean;
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
    },
    {
      id: 'expanded',
      name: 'Expanded',
      type: 'boolean'
    }
  ]
};

const createOutline = (bounds: Box, radius: number) => {
  const xr = radius / bounds.w;
  const yr = radius / bounds.h;

  return new PathListBuilder()
    .withTransform(fromUnitLCS(bounds))
    .moveTo(_p(xr, 0))
    .lineTo(_p(1 - xr, 0))
    .arcTo(_p(1, yr), xr, yr, 0, 0, 1)
    .lineTo(_p(1, 1 - yr))
    .arcTo(_p(1 - xr, 1), xr, yr, 0, 0, 1)
    .lineTo(_p(xr, 1))
    .arcTo(_p(0, 1 - yr), xr, yr, 0, 0, 1)
    .lineTo(_p(0, yr))
    .arcTo(_p(xr, 0), xr, yr, 0, 0, 1);
};

type MarkerSpec = {
  left: MarkerType[];
  center: MarkerType[];
  right: MarkerType[];
};

export class BPMNActivityNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnActivity', 'BPMN Activity', BPMNActivityNodeDefinition.Shape);
  }

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

      const markers: MarkerSpec = { left: [], center: [], right: [] };
      if (BPMNActivityNodeDefinition.isSubprocessActivity(activityType)) {
        if (!data.expanded) markers.center.push('subprocess');

        if (data.subprocessType === 'loop') markers.left.push('loop');
        else if (data.subprocessType === 'compensation') markers.left.push('compensation');
        else if (data.subprocessType === 'ad-hoc') markers.right.push('ad-hoc');
        else if (data.subprocessType === 'compensation-and-ad-hoc') {
          markers.left.push('compensation');
          markers.right.push('ad-hoc');
        } else if (data.subprocessType === 'multi-instance') markers.left.push('parallel');
      } else {
        // Use individual marker properties for regular tasks
        if (data.loop) markers.center.push('loop');
        if (data.multiInstance === 'sequential') markers.center.push('sequential');
        if (data.multiInstance === 'parallel') markers.center.push('parallel');
        if (data.compensation) markers.center.push('compensation');
      }

      this.addMarkers(node, markers, shapeBuilder);

      if (activityType === 'transaction') {
        shapeBuilder.path(
          createOutline(
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
        const icon = getSVGIcon(iconSvg);

        const dest = Box.fromCorners(
          _p(node.bounds.x + ICON_MARGIN, node.bounds.y + ICON_MARGIN),
          _p(node.bounds.x + ICON_MARGIN + ICON_SIZE, node.bounds.y + ICON_MARGIN + ICON_SIZE)
        );
        this.renderIcon(icon, dest, props.nodeProps, shapeBuilder);
      }

      shapeBuilder.text(this);
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

    private addMarkers(node: DiagramNode, markers: MarkerSpec, shapeBuilder: ShapeBuilder) {
      const renderMarkers = (markers: MarkerType[], pos: Point) => {
        let currentX = pos.x;

        for (const marker of markers) {
          let icon: Icon;
          switch (marker) {
            case 'loop':
              icon = getSVGIcon(arrowBackUpIcon);
              break;
            case 'compensation':
              icon = getSVGIcon(playerTrackPrevIcon);
              break;
            case 'ad-hoc':
              icon = getSVGIcon(tildeIcon);
              break;
            case 'subprocess':
              icon = getSVGIcon(squarePlusIcon);
              break;
            case 'sequential':
              icon = getSVGIcon(linesHorizontalIcon);
              break;
            case 'parallel':
              icon = getSVGIcon(linesVerticalIcon);
              break;
          }

          this.renderIcon(
            icon,
            Box.fromCorners(_p(currentX, pos.y), _p(currentX + MARKER_SIZE, pos.y + MARKER_SIZE)),
            node.renderProps,
            shapeBuilder
          );

          currentX += MARKER_SIZE + MARKER_SPACING;
        }
      };

      const width = (arr: MarkerType[]) =>
        arr.length * MARKER_SIZE + (arr.length - 1) * MARKER_SPACING;

      const bounds = node.bounds;
      const centerX = bounds.x + bounds.w / 2;

      const y = bounds.y + bounds.h - MARKER_SIZE - BOTTOM_MARGIN;

      const centerWidth = width(markers.center);
      renderMarkers(markers.center, _p(centerX - centerWidth / 2, y));

      const leftWidth = width(markers.left);
      renderMarkers(markers.left, _p(centerX - centerWidth / 2 - MARKER_SPACING - leftWidth, y));

      renderMarkers(markers.right, _p(centerX + centerWidth / 2 + MARKER_SPACING, y));
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

  getCustomPropertyDefinitions(node: DiagramNode) {
    const def = new CustomPropertyDefinition(p => [
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
    return createOutline(node.bounds, node.renderProps.custom.bpmnActivity.radius);
  }
}
