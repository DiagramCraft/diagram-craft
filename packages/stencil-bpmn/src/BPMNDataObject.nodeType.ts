import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Box } from '@diagram-craft/geometry/box';
import { TransformFactory } from '@diagram-craft/geometry/transform';
import { mustExist } from '@diagram-craft/utils/assert';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { _p } from '@diagram-craft/geometry/point';
import { arrowBigRightFilledIcon, arrowBigRightIcon, linesVerticalIcon } from './icons/icons';
import {
  createBelowShapeTextBox,
  getIcon,
  Icon,
  RECTANGULAR_SHAPE_ANCHORS,
  renderIcon,
  renderMarkers
} from '@diagram-craft/stencil-bpmn/utils';
import { CustomPropertyDefinition } from '@diagram-craft/model/elementDefinitionRegistry';
import { DataSchema } from '@diagram-craft/model/diagramDocumentDataSchemas';
import { Anchor } from '@diagram-craft/model/anchor';
import { ICON_SIZE, MARKER_SIZE } from '@diagram-craft/stencil-bpmn/spacing';

const ICON_MARGIN = 2;
const BOTTOM_MARGIN = 1;

type Data = {
  collection?: boolean;
  type?: string;
};

const SCHEMA: DataSchema = {
  id: 'bpmnDataObject',
  name: 'BPMN Data Object',
  providerId: 'default',
  fields: [
    {
      id: 'name',
      name: 'Name',
      type: 'text'
    },
    {
      id: 'collection',
      name: 'Collection',
      type: 'boolean'
    },
    {
      id: 'type',
      name: 'Type',
      type: 'select',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Input', value: 'input' },
        { label: 'Output', value: 'output' }
      ]
    }
  ]
};

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

// NodeDefinition and Shape *****************************************************

export class BPMNDataObjectNodeType extends ShapeNodeDefinition {
  constructor() {
    super('bpmnDataObject', 'BPMN Data Object', BPMNDataObjectNodeType.Shape);
  }

  static Shape = class extends BaseNodeComponent<BPMNDataObjectNodeType> {
    private getData(node: DiagramNode): Data {
      const data = node.metadata.data?.data?.find(e => e.schema === 'bpmnDataObject');
      return { type: 'default', ...(data?.data ?? {}) } as Data;
    }

    buildShape(props: BaseShapeBuildShapeProps, shapeBuilder: ShapeBuilder) {
      const bounds = props.node.bounds;

      shapeBuilder.boundaryPath(
        new BPMNDataObjectNodeType().getBoundingPathBuilder(props.node).getPaths().all()
      );

      shapeBuilder.path(
        PathListBuilder.fromPath(mustExist(innerPaths.all()[0]))
          .getPaths(TransformFactory.fromTo(pathBounds, Box.withoutRotation(bounds)))
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
        createBelowShapeTextBox(bounds)
      );

      const data = this.getData(props.node);

      if (data.collection) {
        renderMarkers(
          props.node,
          { center: [getIcon(linesVerticalIcon)], left: [], right: [] },
          shapeBuilder,
          { size: MARKER_SIZE, spacing: 0, bottomMargin: BOTTOM_MARGIN }
        );
      }

      let icon: Icon | undefined;
      if (data.type === 'input') {
        icon = getIcon(arrowBigRightIcon);
      } else if (data.type === 'output') {
        icon = getIcon(arrowBigRightFilledIcon);
      }

      if (icon) {
        renderIcon(
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
  };

  getBoundingPathBuilder(def: DiagramNode) {
    const t = TransformFactory.fromTo(pathBounds, Box.withoutRotation(def.bounds));
    return PathListBuilder.fromPath(path).withTransform(t);
  }

  getCustomPropertyDefinitions(_node: DiagramNode) {
    const def = new CustomPropertyDefinition();
    def.dataSchemas = [SCHEMA];
    return def;
  }

  getShapeAnchors(_def: DiagramNode): Anchor[] {
    return RECTANGULAR_SHAPE_ANCHORS;
  }
}
