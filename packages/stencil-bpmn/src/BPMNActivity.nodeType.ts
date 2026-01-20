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

type SubprocessType =
  | 'default'
  | 'loop'
  | 'multi-instance'
  | 'compensation'
  | 'ad-hoc'
  | 'compensation-and-ad-hoc';

type MarkerType = 'loop' | 'multi' | 'compensation';
type AllMarkerType = MarkerType | 'ad-hoc';

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
const SUBPROCESS_INDICATOR_SIZE = 14;
const BOTTOM_MARGIN = 5;
const TRANSACTION_OFFSET = 3;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnActivity?: {
        taskType?: string;
        activityType?: string;
        radius?: number;
        loop?: boolean;
        multiInstance?: 'none' | 'sequential' | 'parallel';
        compensation?: boolean;
        subprocessType?: SubprocessType;
        expanded?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnActivity', {
  taskType: 'regular',
  activityType: 'task',
  radius: 5,
  loop: false,
  multiInstance: 'none',
  compensation: false,
  subprocessType: 'default',
  expanded: false
});

export class BPMNActivityNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnActivity', 'BPMN Activity', BPMNActivityNodeDefinition.Shape);
  }

  private static createOuterPath(bounds: Box, radius: number) {
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
  }

  private static isSubprocessActivity(activityType: string): boolean {
    return (
      activityType === 'sub-process' ||
      activityType === 'event-sub-process' ||
      activityType === 'transaction'
    );
  }

  static Shape = class extends BaseNodeComponent<BPMNActivityNodeDefinition> {
    protected adjustStyle(
      el: DiagramNode,
      nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      if (
        nodeProps.custom.bpmnActivity.activityType === 'event-sub-process' &&
        el.getPropsInfo('stroke.pattern')!.at(-1)!.type === 'default'
      ) {
        style.strokeDasharray = '2 5';
      }

      if (nodeProps.custom.bpmnActivity.activityType === 'transaction') {
        style.strokeWidth = '1.5';
      }
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      shapeBuilder.boundaryPath(
        new BPMNActivityNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      const activityType = node.renderProps.custom.bpmnActivity.activityType ?? 'task';
      const isSubprocess = BPMNActivityNodeDefinition.isSubprocessActivity(activityType);
      const expanded = node.renderProps.custom.bpmnActivity.expanded ?? false;

      // Render boxed + icon for collapsed subprocesses only
      if (isSubprocess && !expanded) {
        this.buildSubprocessIndicator(node, shapeBuilder);
      }

      // Determine which markers to render
      // hasSubprocessIndicator is true only when we actually render the + icon
      const hasSubprocessIndicator = isSubprocess && !expanded;

      if (isSubprocess) {
        // For all subprocesses (collapsed or expanded), use subprocess type to determine markers
        const subprocessType = node.renderProps.custom.bpmnActivity.subprocessType ?? 'default';
        this.buildSubprocessMarkers(node, subprocessType, hasSubprocessIndicator, shapeBuilder);
      } else {
        // Use individual marker properties for regular tasks
        const loop = node.renderProps.custom.bpmnActivity.loop ?? false;
        const multiInstance = node.renderProps.custom.bpmnActivity.multiInstance ?? 'none';
        const compensation = node.renderProps.custom.bpmnActivity.compensation ?? false;
        this.buildMarkers(node, loop, multiInstance, compensation, false, false, shapeBuilder);
      }

      if (props.nodeProps.custom.bpmnActivity.activityType === 'transaction') {
        shapeBuilder.path(
          BPMNActivityNodeDefinition.createOuterPath(
            Box.fromCorners(
              _p(node.bounds.x + TRANSACTION_OFFSET, node.bounds.y + TRANSACTION_OFFSET),
              _p(
                node.bounds.x + node.bounds.w - TRANSACTION_OFFSET,
                node.bounds.y + node.bounds.h - TRANSACTION_OFFSET
              )
            ),
            node.renderProps.custom.bpmnActivity.radius - TRANSACTION_OFFSET
          )
            .getPaths()
            .all(),
          undefined,
          {
            style: { fill: 'none' }
          }
        );
      }

      const taskType = props.nodeProps.custom.bpmnActivity.taskType;
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
          .getPaths(
            TransformFactory.fromTo(
              Box.fromCorners(
                _p(icon.viewbox.x, icon.viewbox.y),
                _p(icon.viewbox.x + icon.viewbox.w, icon.viewbox.y + icon.viewbox.h)
              ),
              position
            )
          )
          .all(),
        undefined,
        {
          style: {
            fill: icon.fill === 'none' ? 'none' : nodeProps.stroke.color,
            stroke: icon.fill === 'none' ? nodeProps.stroke.color : 'none'
          }
        }
      );
    }

    private buildSubprocessIndicator(node: DiagramNode, shapeBuilder: ShapeBuilder) {
      const centerX = node.bounds.x + node.bounds.w / 2;
      const bottomY = node.bounds.y + node.bounds.h - SUBPROCESS_INDICATOR_SIZE - BOTTOM_MARGIN;

      this.renderIcon(
        getSVGIcon(squarePlusIcon),
        Box.fromCorners(
          _p(centerX - SUBPROCESS_INDICATOR_SIZE / 2, bottomY),
          _p(centerX + SUBPROCESS_INDICATOR_SIZE / 2, bottomY + SUBPROCESS_INDICATOR_SIZE)
        ),
        node.renderProps,
        shapeBuilder
      );
    }

    private buildSubprocessMarkers(
      node: DiagramNode,
      subprocessType: SubprocessType,
      hasSubprocessIndicator: boolean,
      shapeBuilder: ShapeBuilder
    ) {
      // Decode subprocess type into individual markers
      let loop = false;
      let multiInstance: 'none' | 'sequential' | 'parallel' = 'none';
      let compensation = false;
      let adHoc = false;

      switch (subprocessType) {
        case 'loop':
          loop = true;
          break;
        case 'multi-instance':
          multiInstance = 'parallel'; // Default to parallel for multi-instance
          break;
        case 'compensation':
          compensation = true;
          break;
        case 'ad-hoc':
          adHoc = true;
          break;
        case 'compensation-and-ad-hoc':
          compensation = true;
          adHoc = true;
          break;
        default:
          // No markers for default subprocess
          break;
      }

      this.buildMarkers(
        node,
        loop,
        multiInstance,
        compensation,
        adHoc,
        hasSubprocessIndicator,
        shapeBuilder
      );
    }

    private buildMarkers(
      node: DiagramNode,
      loop: boolean,
      multiInstance: 'none' | 'sequential' | 'parallel',
      compensation: boolean,
      adHoc: boolean,
      hasSubprocessIndicator: boolean,
      shapeBuilder: ShapeBuilder
    ) {
      const bounds = node.bounds;
      const centerX = bounds.x + bounds.w / 2;
      const markerSpacing = MARKER_SIZE + MARKER_SPACING;

      if (hasSubprocessIndicator) {
        // For subprocess: position markers on the same line as the + icon
        // Regular markers (loop, multi-instance, compensation) go on the LEFT
        // Ad-hoc marker goes on the RIGHT
        const bottomY = bounds.y + bounds.h - SUBPROCESS_INDICATOR_SIZE - BOTTOM_MARGIN;
        const markerY = bottomY + SUBPROCESS_INDICATOR_SIZE / 2;

        // Collect left-side markers
        const leftMarkers: MarkerType[] = [];
        if (loop) leftMarkers.push('loop');
        if (multiInstance !== 'none') leftMarkers.push('multi');
        if (compensation) leftMarkers.push('compensation');

        // Render left-side markers (to the left of the + icon)
        if (leftMarkers.length > 0) {
          const leftTotalWidth =
            leftMarkers.length * MARKER_SIZE + (leftMarkers.length - 1) * MARKER_SPACING;
          const leftStartX =
            centerX - SUBPROCESS_INDICATOR_SIZE / 2 - MARKER_SPACING - leftTotalWidth;
          let currentX = leftStartX;

          for (const marker of leftMarkers) {
            if (marker === 'loop') {
              this.renderIcon(
                getSVGIcon(arrowBackUpIcon),
                Box.fromCorners(
                  _p(currentX, markerY - MARKER_SIZE / 2),
                  _p(currentX + MARKER_SIZE, markerY + MARKER_SIZE / 2)
                ),
                node.renderProps,
                shapeBuilder
              );
            } else if (marker === 'multi') {
              if (multiInstance === 'sequential') {
                this.renderIcon(
                  getSVGIcon(linesHorizontalIcon),
                  Box.fromCorners(
                    _p(currentX, markerY - MARKER_SIZE / 2),
                    _p(currentX + MARKER_SIZE, markerY + MARKER_SIZE / 2)
                  ),
                  node.renderProps,
                  shapeBuilder
                );
              } else {
                this.renderIcon(
                  getSVGIcon(linesVerticalIcon),
                  Box.fromCorners(
                    _p(currentX, markerY - MARKER_SIZE / 2),
                    _p(currentX + MARKER_SIZE, markerY + MARKER_SIZE / 2)
                  ),
                  node.renderProps,
                  shapeBuilder
                );
              }
            } else if (marker === 'compensation') {
              this.renderIcon(
                getSVGIcon(playerTrackPrevIcon),
                Box.fromCorners(
                  _p(currentX, markerY - MARKER_SIZE / 2),
                  _p(currentX + MARKER_SIZE, markerY + MARKER_SIZE / 2)
                ),
                node.renderProps,
                shapeBuilder
              );
            }
            currentX += markerSpacing;
          }
        }

        // Render ad-hoc marker on the right side of the + icon
        if (adHoc) {
          const rightX = centerX + SUBPROCESS_INDICATOR_SIZE / 2 + MARKER_SPACING;
          this.renderIcon(
            getSVGIcon(tildeIcon),
            Box.fromCorners(
              _p(rightX, markerY - MARKER_SIZE / 2),
              _p(rightX + MARKER_SIZE, markerY + MARKER_SIZE / 2)
            ),
            node.renderProps,
            shapeBuilder
          );
        }
      } else {
        // For regular tasks: position markers at the bottom center (original behavior)
        const bottomY = bounds.y + bounds.h - MARKER_SIZE - BOTTOM_MARGIN;

        // Calculate how many markers we need to render
        const markers: AllMarkerType[] = [];
        if (loop) markers.push('loop');
        if (multiInstance !== 'none') markers.push('multi');
        if (compensation) markers.push('compensation');
        if (adHoc) markers.push('ad-hoc');

        // Calculate spacing between markers
        const totalWidth = markers.length * MARKER_SIZE + (markers.length - 1) * MARKER_SPACING;
        let currentX = centerX - totalWidth / 2;

        // Render each marker
        for (const marker of markers) {
          if (marker === 'loop') {
            this.renderIcon(
              getSVGIcon(arrowBackUpIcon),
              Box.fromCorners(
                _p(currentX, bottomY),
                _p(currentX + MARKER_SIZE, bottomY + MARKER_SIZE)
              ),
              node.renderProps,
              shapeBuilder
            );
          } else if (marker === 'multi') {
            if (multiInstance === 'sequential') {
              this.renderIcon(
                getSVGIcon(linesHorizontalIcon),
                Box.fromCorners(
                  _p(currentX, bottomY),
                  _p(currentX + MARKER_SIZE, bottomY + MARKER_SIZE)
                ),
                node.renderProps,
                shapeBuilder
              );
            } else {
              this.renderIcon(
                getSVGIcon(linesVerticalIcon),
                Box.fromCorners(
                  _p(currentX, bottomY),
                  _p(currentX + MARKER_SIZE, bottomY + MARKER_SIZE)
                ),
                node.renderProps,
                shapeBuilder
              );
            }
          } else if (marker === 'compensation') {
            this.renderIcon(
              getSVGIcon(playerTrackPrevIcon),
              Box.fromCorners(
                _p(currentX, bottomY),
                _p(currentX + MARKER_SIZE, bottomY + MARKER_SIZE)
              ),
              node.renderProps,
              shapeBuilder
            );
          } else if (marker === 'ad-hoc') {
            this.renderIcon(
              getSVGIcon(tildeIcon),
              Box.fromCorners(
                _p(currentX, bottomY),
                _p(currentX + MARKER_SIZE, bottomY + MARKER_SIZE)
              ),
              node.renderProps,
              shapeBuilder
            );
          }
          currentX += markerSpacing;
        }
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
        id: 'activityType',
        type: 'select',
        label: 'Activity Type',
        options: [
          { value: 'task', label: 'Task' },
          { value: 'sub-process', label: 'Sub-process' },
          { value: 'event-sub-process', label: 'Event sub-process' },
          { value: 'transaction', label: 'Transaction' }
        ],
        value: def.renderProps.custom.bpmnActivity.activityType ?? 'task',
        isSet: def.storedProps.custom?.bpmnActivity?.activityType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.activityType = undefined), uow);
          } else {
            def.updateCustomProps('bpmnActivity', props => (props.activityType = value), uow);
          }
        }
      },
      {
        id: 'taskType',
        type: 'select',
        label: 'Task Type',
        options: [
          { value: 'regular', label: 'Regular' },
          { value: 'service', label: 'Service' },
          { value: 'send', label: 'Send' },
          { value: 'receive', label: 'Receive' },
          { value: 'user', label: 'User' },
          { value: 'manual', label: 'Manual' },
          { value: 'business-rule', label: 'Business Rule' },
          { value: 'script', label: 'Script' }
        ],
        value: def.renderProps.custom.bpmnActivity.taskType ?? 'regular',
        isSet: def.storedProps.custom?.bpmnActivity?.taskType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.taskType = undefined), uow);
          } else {
            def.updateCustomProps('bpmnActivity', props => (props.taskType = value), uow);
          }
        }
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop',
        value: def.renderProps.custom.bpmnActivity.loop ?? false,
        isSet: def.storedProps.custom?.bpmnActivity?.loop !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.loop = undefined), uow);
          } else {
            def.updateCustomProps('bpmnActivity', props => (props.loop = value), uow);
          }
        }
      },
      {
        id: 'multiInstance',
        type: 'select',
        label: 'Multi-Instance',
        value: def.renderProps.custom.bpmnActivity.multiInstance ?? 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Sequential', value: 'sequential' },
          { label: 'Parallel', value: 'parallel' }
        ],
        isSet: def.storedProps.custom?.bpmnActivity?.multiInstance !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.multiInstance = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnActivity',
              props => (props.multiInstance = value as 'none' | 'sequential' | 'parallel'),
              uow
            );
          }
        }
      },
      {
        id: 'compensation',
        type: 'boolean',
        label: 'Compensation',
        value: def.renderProps.custom.bpmnActivity.compensation ?? false,
        isSet: def.storedProps.custom?.bpmnActivity?.compensation !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.compensation = undefined), uow);
          } else {
            def.updateCustomProps('bpmnActivity', props => (props.compensation = value), uow);
          }
        }
      },
      {
        id: 'subprocessType',
        type: 'select',
        label: 'Subprocess Type',
        value: def.renderProps.custom.bpmnActivity.subprocessType ?? 'default',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Loop', value: 'loop' },
          { label: 'Multi-Instance', value: 'multi-instance' },
          { label: 'Compensation', value: 'compensation' },
          { label: 'Ad-Hoc', value: 'ad-hoc' },
          { label: 'Compensation and Ad-Hoc', value: 'compensation-and-ad-hoc' }
        ],
        isSet: def.storedProps.custom?.bpmnActivity?.subprocessType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.subprocessType = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnActivity',
              props => (props.subprocessType = value as SubprocessType),
              uow
            );
          }
        }
      },
      {
        id: 'expanded',
        type: 'boolean',
        label: 'Expanded',
        value: def.renderProps.custom.bpmnActivity.expanded ?? false,
        isSet: def.storedProps.custom?.bpmnActivity?.expanded !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.expanded = undefined), uow);
          } else {
            def.updateCustomProps('bpmnActivity', props => (props.expanded = value), uow);
          }
        }
      },
      {
        id: 'radius',
        type: 'number',
        label: 'Radius',
        value: def.renderProps.custom.bpmnActivity.radius,
        maxValue: 60,
        unit: 'px',
        isSet: def.storedProps.custom?.bpmnActivity?.radius !== undefined,
        onChange: (value: number | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnActivity', props => (props.radius = undefined), uow);
          } else {
            if (value >= def.bounds.w / 2 || value >= def.bounds.h / 2) return;

            def.updateCustomProps('bpmnActivity', props => (props.radius = value), uow);
          }
        }
      }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return BPMNActivityNodeDefinition.createOuterPath(
      node.bounds,
      node.renderProps.custom.bpmnActivity.radius
    );
  }
}
