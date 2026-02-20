import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { Point } from '@diagram-craft/geometry/point';
import { assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { newid } from '@diagram-craft/utils/id';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { AbstractPickerDrag } from './abstractPickerDrag';
import { mustExist } from '@diagram-craft/utils/assert';

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="currentColor"/></svg>`;
const WIDTH = 100;
const HEIGHT = 100;

const svgAspectRatio = (svg: string): number => {
  const match = svg.match(/viewBox="([^"]+)"/);
  if (!match) return 1;
  const parts = match[1]!.trim().split(/[\s,]+/);
  if (parts.length < 4) return 1;
  const w = parseFloat(parts[2]!);
  const h = parseFloat(parts[3]!);
  return w > 0 && h > 0 ? h / w : 1;
};

export class IconPickerDrag extends AbstractPickerDrag {
  #svgContent: string | undefined;

  constructor(
    event: MouseEvent,
    readonly prefix: string,
    readonly icon: string,
    readonly svgPromise: Promise<string>,
    diagram: Diagram,
    context: Context
  ) {
    super(event, diagram, context);

    svgPromise.then(content => (this.#svgContent = content));
    this.addDragImage({ x: event.clientX, y: event.clientY });
  }

  protected createDragImageContent(): HTMLElement {
    const zoomLevel = this.diagram.viewBox.zoomLevel;
    const baseSize = Math.round(WIDTH / zoomLevel);

    const img = document.createElement('img');
    img.width = baseSize;
    img.height = baseSize;
    img.style.pointerEvents = 'none';
    img.style.opacity = '0.8';

    const defaultNodeStyle = mustExist(this.diagram.document.styles.getNodeStyle('default'));
    const color = defaultNodeStyle?.props.stroke?.color ?? 'black';

    const setSrc = (svg: string) => {
      img.width = baseSize;
      img.height = Math.round(baseSize * svgAspectRatio(svg));
      img.src = `data:image/svg+xml,${encodeURIComponent(svg.replaceAll('currentColor', color))}`;
    };

    if (this.#svgContent) {
      setSrc(this.#svgContent);
    } else {
      this.svgPromise.then(setSrc);
    }

    return img;
  }

  protected addElement(point: Point) {
    const activeLayer = this.diagram.activeLayer;
    assertRegularLayer(activeLayer);

    const svgContent = this.#svgContent ?? DEFAULT_SVG;
    const h = Math.round(HEIGHT * svgAspectRatio(svgContent));

    const { layer: sourceLayer } = createThumbnail((_d, layer, uow) => {
      const node = ElementFactory.node(
        newid(),
        'svg',
        { x: 0, y: 0, w: WIDTH, h, r: 0 },
        layer,
        { custom: { svg: { svgContent } } } as NodeProps,
        {}
      );
      layer.addElement(node, uow);
      return [node];
    }, this.diagram.document.registry);

    this._elements = cloneElements(sourceLayer.elements, activeLayer);
    this._elements.forEach(e => activeLayer.addElement(e, this.uow));

    UnitOfWork.execute(this.diagram, uow => {
      assignNewBounds(this._elements, point, Point.of(1, 1), uow);
    });

    this.diagram.selection.setElements(this._elements);

    // This is to handle the edge case in which the SVG didn't fully load when initiating the drag
    if (!this.#svgContent) {
      this.svgPromise.then(svgContent => {
        if (this._elements.length > 0) {
          UnitOfWork.execute(this.diagram, uow => {
            const node = this._elements[0] as DiagramNode;
            node.updateProps(p => (p.custom = { svg: { svgContent } }), uow);
            const { x, y, w } = node.bounds;
            node.setBounds({ x, y, w, h: Math.round(w * svgAspectRatio(svgContent)), r: 0 }, uow);
          });
        }
      });
    }
  }
}
