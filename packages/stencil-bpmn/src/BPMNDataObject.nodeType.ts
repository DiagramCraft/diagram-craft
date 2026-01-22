import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode, NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { mustExist } from '@diagram-craft/utils/assert';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import linesVerticalIcon from './icons/lines-vertical.svg?raw';
import arrowBigRightIcon from './icons/arrow-big-right.svg?raw';
import arrowBigRightFilledIcon from './icons/arrow-big-right-filled.svg?raw';
import { getSVGIcon, Icon } from '@diagram-craft/stencil-bpmn/svgIcon';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      bpmnDataObject?: {
        collection?: boolean;
        type?: string;
      };
    }
  }
}

registerCustomNodeDefaults('bpmnDataObject', {
  collection: false,
  type: 'default'
});

const templatePaths = PathListBuilder.fromString(
  `
      M 0 0
      L 7 0
      L 10 2.5
      L 10 10
      L 0 10
      Z
    `
).getPaths();

const innerPaths = PathListBuilder.fromString(
  `
      M 7 0
      L 7 2.5
      L 10 2.5
    `
).getPaths();

const pathBounds = templatePaths.bounds();
const path = mustExist(templatePaths.all()[0]);

const ICON_MARGIN = 2;
const ICON_SIZE = 15;
const MARKER_SIZE = 12;
const BOTTOM_MARGIN = 1;

// NodeDefinition and Shape *****************************************************

export class BPMNDataObjectNodeType extends ShapeNodeDefinition {
  constructor() {
    super('bpmnDataObject', 'BPMN Data Object', BPMNDataObjectNodeType.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNDataObjectNodeType> {
    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      shapeBuilder.boundaryPath(
        new BPMNDataObjectNodeType().getBoundingPathBuilder(props.node).getPaths().all()
      );

      shapeBuilder.path(
        PathListBuilder.fromPath(mustExist(innerPaths.all()[0]))
          .getPaths(TransformFactory.fromTo(pathBounds, Box.withoutRotation(props.node.bounds)))
          .all(),
        undefined,
        {
          style: { fill: 'none' }
        }
      );

      shapeBuilder.text(
        this,
        '1',
        props.node.getText(),
        props.nodeProps.text,
        Box.fromCorners(
          _p(props.node.bounds.x - 50, props.node.bounds.y + props.node.bounds.h + 10),
          _p(
            props.node.bounds.x + props.node.bounds.w + 50,
            props.node.bounds.y + props.node.bounds.h + 20
          )
        )
      );

      const dataObjectProps = props.node.renderProps.custom.bpmnDataObject;
      const bounds = props.node.bounds;

      if (dataObjectProps.collection) {
        this.renderIcon(
          getSVGIcon(linesVerticalIcon),
          Box.fromCorners(
            _p(
              bounds.x + bounds.w / 2 - MARKER_SIZE / 2,
              bounds.y + bounds.h - BOTTOM_MARGIN - MARKER_SIZE
            ),
            _p(bounds.x + bounds.w / 2 + MARKER_SIZE / 2, bounds.y + bounds.h - BOTTOM_MARGIN)
          ),
          props.nodeProps,
          shapeBuilder
        );
      }

      let icon: Icon | undefined;
      if (dataObjectProps.type === 'input') {
        icon = getSVGIcon(arrowBigRightIcon);
      } else if (dataObjectProps.type === 'output') {
        icon = getSVGIcon(arrowBigRightFilledIcon);
      }

      if (icon) {
        this.renderIcon(
          icon,
          Box.fromCorners(
            _p(bounds.x + ICON_MARGIN, bounds.y + ICON_MARGIN),
            _p(bounds.x + ICON_SIZE + ICON_MARGIN, bounds.y + ICON_SIZE + ICON_MARGIN)
          ),
          props.nodeProps,
          shapeBuilder
        );
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
    const t = TransformFactory.fromTo(pathBounds, Box.withoutRotation(def.bounds));
    return PathListBuilder.fromPath(path).withTransform(t);
  }

  getCustomPropertyDefinitions(def: DiagramNode) {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Collection', 'custom.bpmnDataObject.collection'),
      p.select(def, 'Type', 'custom.bpmnDataObject.type', [
        { label: 'Default', value: 'default' },
        { label: 'Input', value: 'input' },
        { label: 'Output', value: 'output' }
      ])
    ]);
  }
}
