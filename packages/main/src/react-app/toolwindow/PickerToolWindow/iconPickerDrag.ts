import { DiagramNode } from '@diagram-craft/model/diagramNode';
import { Diagram } from '@diagram-craft/model/diagram';
import { Context } from '@diagram-craft/canvas/context';
import { Point } from '@diagram-craft/geometry/point';
import { addAllChildren, assignNewBounds, cloneElements } from '@diagram-craft/model/diagramElementUtils';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { createThumbnail } from '@diagram-craft/canvas-app/diagramThumbnail';
import { assertRegularLayer } from '@diagram-craft/model/diagramLayerUtils';
import { ElementFactory } from '@diagram-craft/model/elementFactory';
import { newid } from '@diagram-craft/utils/id';
import type { NodeProps } from '@diagram-craft/model/diagramProps';
import { AbstractPickerDrag } from './abstractPickerDrag';

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="currentColor"/></svg>`;

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

    svgPromise.then(content => {
      this.#svgContent = content;
    });

    this.addDragImage({ x: event.clientX, y: event.clientY });
  }

  protected createDragImageContent(): HTMLElement {
    const img = document.createElement('img');
    img.width = 35;
    img.height = 35;
    img.style.pointerEvents = 'none';
    img.style.opacity = '0.8';

    const setSrc = (svg: string) => {
      img.src = `data:image/svg+xml,${encodeURIComponent(svg.replaceAll('currentColor', '#1a1a1a'))}`;
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
    const h = Math.round(100 * svgAspectRatio(svgContent));

    const { layer: sourceLayer } = createThumbnail(
      (_d, layer, uow) => {
        const node = ElementFactory.node(
          newid(),
          'svg',
          { x: 0, y: 0, w: 100, h, r: 0 },
          layer,
          { custom: { svg: { svgContent } } } as NodeProps,
          {}
        );
        layer.addElement(node, uow);
        return [node];
      },
      this.diagram.document.registry
    );

    this._elements = cloneElements(sourceLayer.elements, activeLayer);

    this._elements.forEach(e => {
      activeLayer.addElement(e, this.uow);
      addAllChildren(e, this.uow);
    });

    UnitOfWork.execute(this.diagram, uow => {
      assignNewBounds(this._elements, point, Point.of(1, 1), uow);
    });

    this.diagram.selection.clear();
    this.diagram.selection.setElements(this._elements);

    if (!this.#svgContent) {
      this.svgPromise.then(content => {
        if (this._elements.length > 0) {
          UnitOfWork.execute(this.diagram, uow => {
            const node = this._elements[0] as DiagramNode;
            node.updateProps(p => {
              p.custom ??= {};
              p.custom.svg ??= {};
              p.custom.svg.svgContent = content;
            }, uow);
            const { x, y, w } = node.bounds;
            node.setBounds({ x, y, w, h: Math.round(w * svgAspectRatio(content)), r: 0 }, uow);
          });
        }
      });
    }
  }
}
