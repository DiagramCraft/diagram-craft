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
import handFingerRightIcon from './icons/hand-finger-right.svg?raw';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnTask?: {
        taskType?: string;
        type?: string;
        radius?: number;
        loop?: boolean;
        multiInstance?: 'none' | 'sequential' | 'parallel';
        compensation?: boolean;
        subprocessType?:
          | 'default'
          | 'loop'
          | 'multi-instance'
          | 'compensation'
          | 'ad-hoc'
          | 'compensation-and-ad-hoc';
        expanded?: boolean;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnTask', {
  taskType: 'regular',
  type: 'task',
  radius: 5,
  loop: false,
  multiInstance: 'none',
  compensation: false,
  subprocessType: 'default',
  expanded: false
});

const createOuterPath = (bounds: Box, radius: number) => {
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

export class BPMNTaskNodeDefinition extends ShapeNodeDefinition {
  constructor() {
    super('bpmnTask', 'BPMN Task', BPMNTaskNodeDefinition.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNTaskNodeDefinition> {
    protected adjustStyle(
      el: DiagramNode,
      nodeProps: NodePropsForRendering,
      style: Partial<CSSStyleDeclaration>
    ) {
      if (
        nodeProps.custom.bpmnTask.type === 'event-sub-process' &&
        el.getPropsInfo('stroke.pattern')!.at(-1)!.type === 'default'
      ) {
        style.strokeDasharray = '2 5';
      }

      if (nodeProps.custom.bpmnTask.type === 'transaction') {
        style.strokeWidth = '1.5';
      }
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const node = props.node;
      shapeBuilder.boundaryPath(
        new BPMNTaskNodeDefinition().getBoundingPathBuilder(node).getPaths().all()
      );

      const taskType = node.renderProps.custom.bpmnTask.type ?? 'task';
      const isSubprocess =
        taskType === 'sub-process' ||
        taskType === 'event-sub-process' ||
        taskType === 'transaction';
      const expanded = node.renderProps.custom.bpmnTask.expanded ?? false;

      // Render boxed + icon for collapsed subprocesses only
      if (isSubprocess && !expanded) {
        this.buildSubprocessIndicator(node, shapeBuilder);
      }

      // Determine which markers to render
      // hasSubprocessIndicator is true only when we actually render the + icon
      const hasSubprocessIndicator = isSubprocess && !expanded;

      if (isSubprocess) {
        // For all subprocesses (collapsed or expanded), use subprocess type to determine markers
        const subprocessType = node.renderProps.custom.bpmnTask.subprocessType ?? 'default';
        this.buildSubprocessMarkers(node, subprocessType, hasSubprocessIndicator, shapeBuilder);
      } else {
        // Use individual marker properties for regular tasks
        const loop = node.renderProps.custom.bpmnTask.loop ?? false;
        const multiInstance = node.renderProps.custom.bpmnTask.multiInstance ?? 'none';
        const compensation = node.renderProps.custom.bpmnTask.compensation ?? false;
        this.buildMarkers(node, loop, multiInstance, compensation, false, false, shapeBuilder);
      }

      if (props.nodeProps.custom.bpmnTask.type === 'transaction') {
        const offset = 3;
        shapeBuilder.path(
          createOuterPath(
            Box.fromCorners(
              _p(node.bounds.x + offset, node.bounds.y + offset),
              _p(node.bounds.x + node.bounds.w - offset, node.bounds.y + node.bounds.h - offset)
            ),
            node.renderProps.custom.bpmnTask.radius - offset
          )
            .getPaths()
            .all(),
          undefined,
          {
            style: { fill: 'none' }
          }
        );
      }

      let icon: Icon | undefined;
      if (props.nodeProps.custom.bpmnTask.taskType === 'service') {
        icon = getSVGIcon(settingsIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'send') {
        icon = getSVGIcon(mailFilledIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'receive') {
        icon = getSVGIcon(mailIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'user') {
        icon = getSVGIcon(userIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'manual') {
        icon = getSVGIcon(handFingerRightIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'business-rule') {
        icon = getSVGIcon(tableIcon);
      } else if (props.nodeProps.custom.bpmnTask.taskType === 'script') {
        icon = getSVGIcon(scriptIcon);
      }

      if (icon) {
        const margin = 5;
        const iconSize = 15;
        shapeBuilder.path(
          PathListBuilder.fromPathList(icon.pathList)
            .getPaths(
              TransformFactory.fromTo(
                Box.fromCorners(
                  _p(icon.viewbox.x, icon.viewbox.y),
                  _p(icon.viewbox.x + icon.viewbox.w, icon.viewbox.y + icon.viewbox.h)
                ),
                Box.fromCorners(
                  _p(node.bounds.x + margin, node.bounds.y + margin),
                  _p(node.bounds.x + margin + iconSize, node.bounds.y + margin + iconSize)
                )
              )
            )
            .all(),
          undefined,
          {
            style: {
              fill: icon.fill === 'none' ? 'none' : props.nodeProps.stroke.color,
              stroke: icon.fill === 'none' ? props.nodeProps.stroke.color : 'none'
            }
          }
        );
      }

      shapeBuilder.text(this);
    }

    private buildSubprocessIndicator(node: DiagramNode, shapeBuilder: ShapeBuilder) {
      const bounds = node.bounds;
      const boxSize = 14; // Size of the square box
      const centerX = bounds.x + bounds.w / 2;
      const bottomY = bounds.y + bounds.h - boxSize - 5; // 5px from bottom

      // Draw the box
      const pathBuilder = new PathListBuilder()
        .moveTo(_p(centerX - boxSize / 2, bottomY))
        .lineTo(_p(centerX + boxSize / 2, bottomY))
        .lineTo(_p(centerX + boxSize / 2, bottomY + boxSize))
        .lineTo(_p(centerX - boxSize / 2, bottomY + boxSize))
        .lineTo(_p(centerX - boxSize / 2, bottomY));

      // Draw the + inside the box
      const plusSize = boxSize * 0.5;
      const plusCenterX = centerX;
      const plusCenterY = bottomY + boxSize / 2;

      // Horizontal line of +
      pathBuilder
        .moveTo(_p(plusCenterX - plusSize / 2, plusCenterY))
        .lineTo(_p(plusCenterX + plusSize / 2, plusCenterY));

      // Vertical line of +
      pathBuilder
        .moveTo(_p(plusCenterX, plusCenterY - plusSize / 2))
        .lineTo(_p(plusCenterX, plusCenterY + plusSize / 2));

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none', fill: 'none' }
      });
    }

    private buildSubprocessMarkers(
      node: DiagramNode,
      subprocessType:
        | 'default'
        | 'loop'
        | 'multi-instance'
        | 'compensation'
        | 'ad-hoc'
        | 'compensation-and-ad-hoc',
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
        case 'default':
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
      const size = 12; // Size of markers
      const centerX = bounds.x + bounds.w / 2;
      const markerSpacing = size + 4;

      if (hasSubprocessIndicator) {
        // For subprocess: position markers on the same line as the + icon
        // Regular markers (loop, multi-instance, compensation) go on the LEFT
        // Ad-hoc marker goes on the RIGHT
        const subprocessIndicatorSize = 14;
        const bottomY = bounds.y + bounds.h - subprocessIndicatorSize - 5; // Same level as + icon
        const markerY = bottomY + subprocessIndicatorSize / 2; // Center vertically with + icon

        // Collect left-side markers
        const leftMarkers: Array<'loop' | 'multi' | 'compensation'> = [];
        if (loop) leftMarkers.push('loop');
        if (multiInstance !== 'none') leftMarkers.push('multi');
        if (compensation) leftMarkers.push('compensation');

        // Render left-side markers (to the left of the + icon)
        if (leftMarkers.length > 0) {
          const leftTotalWidth = leftMarkers.length * size + (leftMarkers.length - 1) * 4;
          const leftStartX = centerX - subprocessIndicatorSize / 2 - 4 - leftTotalWidth;
          let currentX = leftStartX;

          for (const marker of leftMarkers) {
            if (marker === 'loop') {
              this.buildLoopMarker(currentX + size / 2, markerY, size / 2, shapeBuilder);
            } else if (marker === 'multi') {
              if (multiInstance === 'sequential') {
                this.buildSequentialMarker(currentX + size / 2, markerY, size, shapeBuilder);
              } else {
                this.buildParallelMarker(currentX + size / 2, markerY, size, shapeBuilder);
              }
            } else if (marker === 'compensation') {
              this.buildCompensationMarker(currentX + size / 2, markerY, size, shapeBuilder);
            }
            currentX += markerSpacing;
          }
        }

        // Render ad-hoc marker on the right side of the + icon
        if (adHoc) {
          const rightX = centerX + subprocessIndicatorSize / 2 + 4;
          this.buildAdHocMarker(rightX + size / 2, markerY, size, shapeBuilder);
        }
      } else {
        // For regular tasks: position markers at the bottom center (original behavior)
        const bottomY = bounds.y + bounds.h - size - 5;

        // Calculate how many markers we need to render
        const markers: Array<'loop' | 'multi' | 'compensation' | 'ad-hoc'> = [];
        if (loop) markers.push('loop');
        if (multiInstance !== 'none') markers.push('multi');
        if (compensation) markers.push('compensation');
        if (adHoc) markers.push('ad-hoc');

        // Calculate spacing between markers
        const totalWidth = markers.length * size + (markers.length - 1) * 4;
        let currentX = centerX - totalWidth / 2;

        // Render each marker
        for (const marker of markers) {
          if (marker === 'loop') {
            this.buildLoopMarker(currentX + size / 2, bottomY + size / 2, size / 2, shapeBuilder);
          } else if (marker === 'multi') {
            if (multiInstance === 'sequential') {
              this.buildSequentialMarker(
                currentX + size / 2,
                bottomY + size / 2,
                size,
                shapeBuilder
              );
            } else {
              this.buildParallelMarker(currentX + size / 2, bottomY + size / 2, size, shapeBuilder);
            }
          } else if (marker === 'compensation') {
            this.buildCompensationMarker(
              currentX + size / 2,
              bottomY + size / 2,
              size,
              shapeBuilder
            );
          } else if (marker === 'ad-hoc') {
            this.buildAdHocMarker(currentX + size / 2, bottomY + size / 2, size, shapeBuilder);
          }
          currentX += markerSpacing;
        }
      }
    }

    private buildLoopMarker(cx: number, cy: number, r: number, shapeBuilder: ShapeBuilder) {
      // Standard loop: circular arrow
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

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none' }
      });
    }

    private buildSequentialMarker(
      cx: number,
      cy: number,
      size: number,
      shapeBuilder: ShapeBuilder
    ) {
      // Sequential: three horizontal lines
      const lineWidth = size;
      const lineSpacing = size / 4;
      const startX = cx - lineWidth / 2;
      const startY = cy - lineSpacing;

      const pathBuilder = new PathListBuilder()
        .moveTo(_p(startX, startY))
        .lineTo(_p(startX + lineWidth, startY))
        .moveTo(_p(startX, startY + lineSpacing))
        .lineTo(_p(startX + lineWidth, startY + lineSpacing))
        .moveTo(_p(startX, startY + lineSpacing * 2))
        .lineTo(_p(startX + lineWidth, startY + lineSpacing * 2));

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none' }
      });
    }

    private buildParallelMarker(cx: number, cy: number, size: number, shapeBuilder: ShapeBuilder) {
      // Parallel: three vertical lines
      const lineHeight = size;
      const lineSpacing = size / 4;
      const startX = cx - lineSpacing;
      const startY = cy - lineHeight / 2;

      const pathBuilder = new PathListBuilder()
        .moveTo(_p(startX, startY))
        .lineTo(_p(startX, startY + lineHeight))
        .moveTo(_p(startX + lineSpacing, startY))
        .lineTo(_p(startX + lineSpacing, startY + lineHeight))
        .moveTo(_p(startX + lineSpacing * 2, startY))
        .lineTo(_p(startX + lineSpacing * 2, startY + lineHeight));

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none' }
      });
    }

    private buildCompensationMarker(
      cx: number,
      cy: number,
      size: number,
      shapeBuilder: ShapeBuilder
    ) {
      // Compensation: two triangles pointing left (like a rewind symbol <<)
      const triangleWidth = size / 2;
      const triangleHeight = size * 0.8;

      // Left triangle (pointing left)
      const leftTriangleCenterX = cx - triangleWidth / 2;
      // Right triangle (pointing left)
      const rightTriangleCenterX = cx + triangleWidth / 2;

      const pathBuilder = new PathListBuilder()
        // First triangle (left) - point on left, base on right
        .moveTo(_p(leftTriangleCenterX - triangleWidth / 2, cy))
        .lineTo(_p(leftTriangleCenterX + triangleWidth / 2, cy - triangleHeight / 2))
        .lineTo(_p(leftTriangleCenterX + triangleWidth / 2, cy + triangleHeight / 2))
        .lineTo(_p(leftTriangleCenterX - triangleWidth / 2, cy))
        // Second triangle (right) - point on left, base on right
        .moveTo(_p(rightTriangleCenterX - triangleWidth / 2, cy))
        .lineTo(_p(rightTriangleCenterX + triangleWidth / 2, cy - triangleHeight / 2))
        .lineTo(_p(rightTriangleCenterX + triangleWidth / 2, cy + triangleHeight / 2))
        .lineTo(_p(rightTriangleCenterX - triangleWidth / 2, cy));

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none' }
      });
    }

    private buildAdHocMarker(cx: number, cy: number, size: number, shapeBuilder: ShapeBuilder) {
      // Ad-hoc: tilde (~) symbol
      const width = size;
      const amplitude = size / 2;
      const startX = cx - width / 2;

      // Draw a tilde using two curves
      const pathBuilder = new PathListBuilder()
        .moveTo(_p(startX, cy))
        .cubicTo(
          _p(startX + width, cy),
          _p(startX + (3 * width) / 8, cy - amplitude),
          _p(startX + (5 * width) / 8, cy + amplitude)
        );

      shapeBuilder.path(pathBuilder.getPaths().all(), undefined, {
        style: { strokeWidth: '1', strokeDasharray: 'none', fill: 'none' }
      });
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
        value: def.renderProps.custom.bpmnTask.taskType ?? 'regular',
        isSet: def.storedProps.custom?.bpmnTask?.taskType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.taskType = undefined), uow);
          } else {
            def.updateCustomProps('bpmnTask', props => (props.taskType = value), uow);
          }
        }
      },
      {
        id: 'type',
        type: 'select',
        label: 'Type',
        options: [
          { value: 'task', label: 'Task' },
          { value: 'sub-process', label: 'Sub-process' },
          { value: 'event-sub-process', label: 'Event sub-process' },
          { value: 'transaction', label: 'Transaction' }
        ],
        value: def.renderProps.custom.bpmnTask.type ?? 'task',
        isSet: def.storedProps.custom?.bpmnTask?.type !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.type = undefined), uow);
          } else {
            def.updateCustomProps('bpmnTask', props => (props.type = value), uow);
          }
        }
      },
      {
        id: 'loop',
        type: 'boolean',
        label: 'Loop',
        value: def.renderProps.custom.bpmnTask.loop ?? false,
        isSet: def.storedProps.custom?.bpmnTask?.loop !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.loop = undefined), uow);
          } else {
            def.updateCustomProps('bpmnTask', props => (props.loop = value), uow);
          }
        }
      },
      {
        id: 'multiInstance',
        type: 'select',
        label: 'Multi-Instance',
        value: def.renderProps.custom.bpmnTask.multiInstance ?? 'none',
        options: [
          { label: 'None', value: 'none' },
          { label: 'Sequential', value: 'sequential' },
          { label: 'Parallel', value: 'parallel' }
        ],
        isSet: def.storedProps.custom?.bpmnTask?.multiInstance !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.multiInstance = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnTask',
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
        value: def.renderProps.custom.bpmnTask.compensation ?? false,
        isSet: def.storedProps.custom?.bpmnTask?.compensation !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.compensation = undefined), uow);
          } else {
            def.updateCustomProps('bpmnTask', props => (props.compensation = value), uow);
          }
        }
      },
      {
        id: 'subprocessType',
        type: 'select',
        label: 'Subprocess Type',
        value: def.renderProps.custom.bpmnTask.subprocessType ?? 'default',
        options: [
          { label: 'Default', value: 'default' },
          { label: 'Loop', value: 'loop' },
          { label: 'Multi-Instance', value: 'multi-instance' },
          { label: 'Compensation', value: 'compensation' },
          { label: 'Ad-Hoc', value: 'ad-hoc' },
          { label: 'Compensation and Ad-Hoc', value: 'compensation-and-ad-hoc' }
        ],
        isSet: def.storedProps.custom?.bpmnTask?.subprocessType !== undefined,
        onChange: (value: string | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.subprocessType = undefined), uow);
          } else {
            def.updateCustomProps(
              'bpmnTask',
              props =>
                (props.subprocessType = value as
                  | 'default'
                  | 'loop'
                  | 'multi-instance'
                  | 'compensation'
                  | 'ad-hoc'
                  | 'compensation-and-ad-hoc'),
              uow
            );
          }
        }
      },
      {
        id: 'expanded',
        type: 'boolean',
        label: 'Expanded',
        value: def.renderProps.custom.bpmnTask.expanded ?? false,
        isSet: def.storedProps.custom?.bpmnTask?.expanded !== undefined,
        onChange: (value: boolean | undefined, uow: UnitOfWork) => {
          if (value === undefined) {
            def.updateCustomProps('bpmnTask', props => (props.expanded = undefined), uow);
          } else {
            def.updateCustomProps('bpmnTask', props => (props.expanded = value), uow);
          }
        }
      },
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
      }
    ];
  }

  getBoundingPathBuilder(node: DiagramNode) {
    return createOuterPath(node.bounds, node.renderProps.custom.bpmnTask.radius);
  }
}
