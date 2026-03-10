import { CollapsibleOverlayComponent } from '@diagram-craft/canvas/shape/collapsible';
import { LayoutCapableShapeNodeDefinition } from '@diagram-craft/canvas/shape/layoutCapableShapeNodeDefinition';
import {
  CustomPropertyDefinition,
  NodeFlags
} from '@diagram-craft/model/elementDefinitionRegistry';
import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { renderChildren } from '@diagram-craft/canvas/components/renderElement';
import { Extent } from '@diagram-craft/geometry/extent';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { _p, Point } from '@diagram-craft/geometry/point';
import { Translation } from '@diagram-craft/geometry/transform';
import { registerCustomNodeDefaults } from '@diagram-craft/model/diagramDefaults';
import * as svg from '@diagram-craft/canvas/component/vdom-svg';
import { Box } from '@diagram-craft/geometry/box';
import { clamp, round } from '@diagram-craft/utils/math';
import { NodeShapeConstructor } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

const DEFAULT_TAB_W = 120;
const DEFAULT_TAB_H = 14;
const MAX_TAB_W_FRACTION = 0.8;
const MIN_TAB_W = 30;
const DEFAULT_COLLAPSED_W = 160;
const DEFAULT_COLLAPSED_H = 100;

const TRI_W = 10;
const TRI_H = 8;
const TRI_MARGIN = 14;
const TRI_EXTRA = 5;
const TRI_V_OFFSET = 4;

declare global {
  namespace DiagramCraft {
    interface CustomNodePropsExtensions {
      umlPackage?: { tabW?: number; tabH?: number; model?: boolean };
    }
  }
}

registerCustomNodeDefaults('umlPackage', {
  tabW: DEFAULT_TAB_W,
  tabH: DEFAULT_TAB_H,
  model: false
});

export class UMLPackageNodeDefinition extends LayoutCapableShapeNodeDefinition {
  overlayComponent = CollapsibleOverlayComponent;
  additionalFillCount = 1;

  // biome-ignore lint/suspicious/noExplicitAny: allows subclassing with a different component
  constructor(type = 'umlPackage', name = 'UML Package', component: NodeShapeConstructor<any> = UMLPackageComponent) {
    super(type, name, component);

    this.setFlags({
      [NodeFlags.StyleFill]: true,
      [NodeFlags.StyleRounding]: false,
      [NodeFlags.ChildrenAllowed]: true,
      [NodeFlags.ChildrenCollapsible]: true,
      [NodeFlags.ChildrenTransformScaleX]: false,
      [NodeFlags.ChildrenTransformScaleY]: false,
      [NodeFlags.ChildrenSelectParent]: false
    });
  }

  getContainerPadding(node: DiagramNode) {
    return { top: this.getTabH(node), bottom: 0, left: 0, right: 0 };
  }

  getCustomPropertyDefinitions(def: DiagramNode): CustomPropertyDefinition {
    return new CustomPropertyDefinition(p => [
      p.boolean(def, 'Model', 'custom.umlPackage.model'),
      ...super.getCollapsiblePropertyDefinitions(def).entries
    ]);
  }

  protected getCollapsedBounds(storedBounds: string | undefined, node: DiagramNode): Box {
    if (storedBounds && storedBounds !== '') return Box.fromString(storedBounds);

    return Box.fromCorners(
      Point.of(node.bounds.x, node.bounds.y),
      Point.of(node.bounds.x + DEFAULT_COLLAPSED_W, node.bounds.y + DEFAULT_COLLAPSED_H)
    );
  }

  getBoundingPathBuilder(node: DiagramNode) {
    const bounds = node.bounds;
    const { w, h } = bounds;
    const tabW = node.renderProps.custom.umlPackage.tabW ?? DEFAULT_TAB_W;
    const effectiveTabW = Math.min(tabW, w * MAX_TAB_W_FRACTION);
    const tabH = this.getTabH(node);

    return new PathListBuilder()
      .withTransform([new Translation(bounds)])
      .moveTo(Point.of(0, 0))
      .lineTo(Point.of(effectiveTabW, 0))
      .lineTo(Point.of(effectiveTabW, tabH))
      .lineTo(Point.of(w, tabH))
      .lineTo(Point.of(w, h))
      .lineTo(Point.of(0, h))
      .close();
  }

  getTabH(node: DiagramNode): number {
    const childrenVisible = node.children.length > 0 && this.shouldRenderChildren(node);
    if (!childrenVisible) return DEFAULT_TAB_H;
    return node.renderProps.custom.umlPackage.tabH ?? DEFAULT_TAB_H;
  }
}

export class UMLPackageComponent extends BaseNodeComponent<UMLPackageNodeDefinition> {
  buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
    const nodeProps = props.nodeProps;
    const bounds = props.node.bounds;
    const { w, h } = bounds;

    const tabW = nodeProps.custom.umlPackage.tabW ?? DEFAULT_TAB_W;
    const maxTabW = w * MAX_TAB_W_FRACTION;
    const effectiveTabW = Math.min(tabW, maxTabW);
    const model = nodeProps.custom.umlPackage.model ?? false;

    const childrenVisible =
      props.node.children.length > 0 && this.def.shouldRenderChildren(props.node);
    const tabH = this.def.getTabH(props.node);

    const boundary = this.def.getBoundingPathBuilder(props.node).getPaths();
    builder.boundaryPath(boundary.all());

    const tabFill = nodeProps.additionalFills?.['0'];
    if (tabFill?.enabled) {
      const strokeWidth = nodeProps.stroke.enabled ? nodeProps.stroke.width : 0;
      const color = tabFill.color ?? 'transparent';
      builder.add(
        svg.rect({
          x: bounds.x + strokeWidth,
          y: bounds.y + strokeWidth,
          width: effectiveTabW - 2 * strokeWidth,
          height: tabH - 2 * strokeWidth,
          fill: color,
          stroke: color,
          style: 'pointer-events: none'
        })
      );
    }

    // Interior line separating tab from body
    const interiorPath = new PathListBuilder().withTransform([new Translation(bounds)]);
    interiorPath.moveTo(Point.of(0, tabH));
    interiorPath.lineTo(Point.of(effectiveTabW, tabH));
    builder.buildInterior().addShape(interiorPath).stroke();

    // Control point to drag-adjust tab width
    builder.controlPoint(_p(bounds.x + effectiveTabW, bounds.y), (p, uow) => {
      const newTabW = clamp(p.x - bounds.x, MIN_TAB_W, maxTabW);
      props.node.updateCustomProps('umlPackage', cp => (cp.tabW = newTabW), uow);
      return `Tab width: ${round(newTabW)}px`;
    });

    // Text: in tab when children visible, in body otherwise
    if (childrenVisible) {
      builder.text(
        this,
        '1',
        props.node.getText(),
        nodeProps.text,
        { x: bounds.x, y: bounds.y, w: effectiveTabW, h: tabH, r: 0 },
        (size: Extent) =>
          UnitOfWork.execute(props.node.diagram, uow => {
            uow.metadata.nonDirty = true;
            props.node.updateCustomProps('umlPackage', p => (p.tabH = size.h), uow);
            this.def.layoutChildren(props.node, uow);
          })
      );
    } else {
      builder.text(this, '1', props.node.getText(), nodeProps.text, {
        x: bounds.x,
        y: bounds.y + DEFAULT_TAB_H,
        w,
        h: h - DEFAULT_TAB_H,
        r: 0
      });
    }

    // Optional model marker triangle
    if (model) {
      let tx: number, ty: number;
      let triW: number, triH: number;
      if (childrenVisible) {
        triW = TRI_W;
        triH = TRI_H;
        tx = bounds.x + effectiveTabW - TRI_MARGIN - TRI_EXTRA;
        ty = bounds.y + tabH / 2 - TRI_V_OFFSET;
      } else {
        triW = TRI_W * 1.5;
        triH = TRI_H * 1.5;
        tx = bounds.x + w - TRI_MARGIN * 1.5 - TRI_EXTRA;
        ty = bounds.y + DEFAULT_TAB_H + TRI_V_OFFSET * 1.5 + TRI_EXTRA;
      }
      builder.add(
        svg.path({
          'd': `M ${tx + triW / 2} ${ty} L ${tx} ${ty + triH} L ${tx + triW} ${ty + triH} Z`,
          'fill': 'none',
          'stroke': nodeProps.stroke.color,
          'stroke-width': nodeProps.stroke.width
        })
      );
    }

    // Render children when expanded
    if (childrenVisible) {
      builder.add(renderChildren(this, props.node, props));
    }
  }
}
