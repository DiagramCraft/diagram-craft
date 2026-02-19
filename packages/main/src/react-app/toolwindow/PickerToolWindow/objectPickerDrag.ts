import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { Point } from '@diagram-craft/geometry/point';
import { addAllChildren, assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { Box } from '@diagram-craft/geometry/box';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { clamp } from '@diagram-craft/utils/math';
import { insert } from '@diagram-craft/canvas/component/vdom';
import { StaticCanvasComponent } from '@diagram-craft/canvas/canvas/StaticCanvasComponent';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { Stylesheet } from '@diagram-craft/model/diagramStyles';
import { StencilStyle } from '@diagram-craft/model/stencilRegistry';
import { AbstractPickerDrag } from './abstractPickerDrag';

export class ObjectPickerDrag extends AbstractPickerDrag {
  constructor(
    event: MouseEvent,
    readonly source: DiagramElement[],
    diagram: Diagram,
    readonly stencilId: string | undefined,
    readonly styles: Array<StencilStyle>,
    context: Context
  ) {
    super(event, diagram, context);
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
    ($canvasEl as SVGElement & HTMLElement).setAttribute(
      'viewBox',
      `-2 -2 ${bounds.w + 4} ${bounds.h + 4}`
    );
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

    this._elements.forEach(e => {
      activeLayer.addElement(e, this.uow);
      addAllChildren(e, this.uow);
    });

    UnitOfWork.execute(this.diagram, uow => {
      assignNewBounds(this._elements, point, Point.of(scaleX, scaleY), uow);
    });

    this.diagram.selection.clear();
    this.diagram.selection.setElements(this._elements);
  }

  protected onDropped() {
    if (this.stencilId) {
      this.diagram.document.props.recentStencils.register(this.stencilId);
    }
  }
}
