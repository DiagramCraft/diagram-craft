import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { Point } from '@diagram-craft/geometry/point';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { clamp } from '@diagram-craft/utils/math';
import { insert } from '@diagram-craft/canvas/component/vdom';
import { StaticCanvasComponent } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { copyStyles, NodeLinkOptions, StencilStyle } from '@diagram-craft/model/stencilRegistry';
import { AbstractPickerDrag } from './abstractPickerDrag';
import { mustExist } from '@diagram-craft/utils/assert';
import { EventHelper } from '@diagram-craft/utils/eventHelper';
import { isNode } from '@diagram-craft/model/diagramElement';

export class ObjectPickerDrag extends AbstractPickerDrag {
  constructor(
    event: MouseEvent,
    readonly source: DiagramElement[],
    readonly diagram: Diagram,
    readonly stencilId: string | undefined,
    readonly styles: Array<StencilStyle>,
    context: Context,
    readonly nodeLinkOptions?: NodeLinkOptions
  ) {
    const sourceBounds = Box.boundingBox(source.map(e => e.bounds));
    const svgElement =
      event.target instanceof Element ? (event.target.closest('svg') as SVGSVGElement | null) : null;

    const dragOffset = svgElement
      ? (() => {
          // Preserve the pointer's relative position inside the picked stencil so the
          // element enters the canvas under the cursor instead of snapping to center.
          const localPoint = EventHelper.pointWithRespectTo(event, svgElement);
          const diagramPoint = source[0]!.diagram.viewBox.toDiagramPoint(localPoint);
          return Point.of(
            clamp(diagramPoint.x - sourceBounds.x, 0, sourceBounds.w),
            clamp(diagramPoint.y - sourceBounds.y, 0, sourceBounds.h)
          );
        })()
      : Point.of(sourceBounds.w / 2, sourceBounds.h / 2);

    super(event, diagram, context, dragOffset);
    this.addDragImage({ x: event.clientX, y: event.clientY });
  }

  protected createDragImageContent(): HTMLElement {
    const scale = clamp(this.diagram.viewBox.zoomLevel, 0.3, 3);

    const { diagram: dest } = createThumbnail((_d, l, uow) => {
      return cloneElements(this.source, l, uow).map(e => {
        l.addElement(e, uow);
        return e;
      });
    }, this.diagram.document.registry);

    const sourceDiagram = mustExist(this.source[0]).diagram;
    UnitOfWork.execute(sourceDiagram, uow => {
      copyStyles(dest, sourceDiagram.document, uow);
      dest.elements.forEach(e => e.clearCache());
    });

    const bounds = Box.boundingBox(this.source.map(e => e.bounds));

    const props = {
      id: `canvas-drag-image-${dest.id}`,
      context: this.context,
      diagram: dest,
      width: bounds.w / scale,
      height: bounds.h / scale
    };

    const canvas = new StaticCanvasComponent(props);
    const $canvasVdomNode = canvas.render(props);
    insert($canvasVdomNode);

    const $canvasEl = $canvasVdomNode.el! as HTMLElement;
    $canvasEl.style.background = 'transparent';
    $canvasEl.setAttribute('viewBox', `-2 -2 ${bounds.w + 4} ${bounds.h + 4}`);
    return $canvasEl;
  }

  protected addElement(point: Point) {
    const styleManager = this.diagram.document.styles;
    for (const style of this.styles) {
      if (styleManager.get(style.id) === undefined) {
        const stylesheet = Stylesheet.fromSnapshot(
          style.type,
          style,
          styleManager.crdt.factory,
          styleManager
        );
        styleManager.addStylesheet(style.id, stylesheet, this.uow);
      }
    }

    const sourceDiagram = this.source[0]!.diagram;
    const sourceLayer = sourceDiagram.activeLayer;
    assertRegularLayer(sourceLayer);

    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    this._elements = cloneElements(sourceLayer.elements, activeLayer);

    const sourceBounds = Box.boundingBox(this.source.map(e => e.bounds));
    const bounds = Box.boundingBox(this._elements.map(e => e.bounds));

    const scaleX = sourceBounds.w / bounds.w;
    const scaleY = Math.max(0.1, sourceBounds.h) / Math.max(0.1, bounds.h);

    this._elements.forEach(e => activeLayer.addElement(e, this.uow));

    if (this.nodeLinkOptions !== undefined) {
      UnitOfWork.execute(this.diagram, uow => {
        for (const el of this._elements) {
          if (isNode(el)) {
            el.getDefinition().setNodeLinkOptions?.(el, this.nodeLinkOptions, uow);
          }
        }
      });
    }

    UnitOfWork.execute(this.diagram, uow => {
      assignNewBounds(this._elements, point, Point.of(scaleX, scaleY), uow);
    });

    this.diagram.selection.clear();
    this.diagram.selection.setElements(this._elements);
  }

  onDragEnd() {
    super.onDragEnd();
    if (this.stencilId && this.wasDroppedInsideCanvas()) {
      this.diagram.document.props.recentStencils.register(this.stencilId);
    }
  }
}
