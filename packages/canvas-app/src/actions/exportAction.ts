import { AbstractAction, ActionContext } from '@diagram-craft/canvas/action';
import { Box } from '@diagram-craft/geometry/box';
import { isEdge } from '@diagram-craft/model/diagramElement';
import { blobToDataURL } from '@diagram-craft/utils/blobUtils';
import { CanvasDomHelper } from '@diagram-craft/canvas/utils/canvasDomHelper';

export const exportActions = (context: ActionContext) => ({
  FILE_EXPORT_IMAGE: new ExportImageAction(context),
  FILE_EXPORT_SVG: new ExportSVGAction(context)
});

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof exportActions> {}
  }
}

const downloadImage = (data: string, filename = 'untitled.png') => {
  const a = document.createElement('a');
  a.href = data;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
};

const downloadSVG = (svgData: string, filename = 'untitled.svg') => {
  const blob = new Blob([svgData], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
};

const MARGIN = 50;
const SCALE = 2;

const prepareSvgForExport = async (context: ActionContext) => {
  const bounds = Box.boundingBox(
    context.model.activeDiagram.visibleElements().flatMap(e => {
      return isEdge(e) ? [e.bounds, ...e.children.map(c => c.bounds)] : [e.bounds];
    })
  );

  const clonedSvg = CanvasDomHelper.diagramElement(context.model.activeDiagram)!.cloneNode(
    true
  ) as HTMLElement;

  const canvasFg = getComputedStyle(document.getElementById('app')!).getPropertyValue(
    '--canvas-fg'
  );
  const canvasBg = getComputedStyle(document.getElementById('app')!).getPropertyValue(
    '--canvas-bg'
  );
  const canvasBg2 = getComputedStyle(document.getElementById('app')!).getPropertyValue(
    '--canvas-bg2'
  );

  clonedSvg.setAttribute(
    'style',
    `--canvas-fg: ${canvasFg}; --canvas-bg: ${canvasBg}; --canvas-bg2: ${canvasBg2};`
  );
  clonedSvg.setAttribute(
    'viewBox',
    `${bounds.x - MARGIN} ${bounds.y - MARGIN} ${bounds.w + 2 * MARGIN} ${bounds.h + 2 * MARGIN}`
  );

  // Cleanup some elements that should not be part of the export
  clonedSvg.querySelector('.svg-doc-bounds')?.remove();
  clonedSvg.querySelector('.svg-grid-container')?.remove();
  clonedSvg.querySelectorAll('.svg-edge__backing').forEach(e => e.remove());

  // Need to embed all object urls
  for (const [, a] of context.model.activeDiagram.document.attachments.attachments) {
    const dataUrl = await a.getDataUrl();
    clonedSvg.querySelectorAll(`image[href="${a.url}"]`).forEach(e => {
      e.setAttribute('href', dataUrl);
    });
  }

  // Download and embed all external images
  for (const [, img] of clonedSvg.querySelectorAll('image').entries()) {
    const href = img.href.baseVal;
    if (href.startsWith('data:')) continue;

    console.log(`Downloading ${href}`);

    const connection = await fetch(href);
    const data = await connection.blob();
    img.setAttribute('href', await blobToDataURL(data));

    console.log('... done');
  }

  return { clonedSvg, bounds };
};

class ExportImageAction extends AbstractAction {
  execute(): void {
    const run = async () => {
      const { clonedSvg, bounds } = await prepareSvgForExport(this.context);

      clonedSvg.setAttribute('width', bounds.w.toString());
      clonedSvg.setAttribute('height', bounds.h.toString());

      // TODO: Remove selection indicators etc

      const canvas = document.createElement('canvas');
      canvas.width = bounds.w * SCALE;
      canvas.height = bounds.h * SCALE;

      const ctx = canvas.getContext('2d')!;
      ctx.scale(SCALE, SCALE);

      // Fill all of canvas with white
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'white';
      ctx.fillRect(0, 0, bounds.w * SCALE, bounds.h * SCALE);

      const img = new Image();
      const svgData = new XMLSerializer().serializeToString(clonedSvg);

      img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`; //btoa(svgData);

      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        downloadImage(canvas.toDataURL('image/png'), 'diagram.png');
        canvas.remove();
      };

      /*
      img.style.position = 'absolute';
      img.style.border = '3px solid pink';
      img.style.left = '20px';
      img.style.top = '20px';
      img.style.width = '200px';
      img.style.height = '200px';
      img.style.background = 'white';
      document.body.appendChild(img);*/
    };
    run();
  }
}

class ExportSVGAction extends AbstractAction {
  execute(): void {
    const run = async () => {
      const { clonedSvg, bounds } = await prepareSvgForExport(this.context);

      clonedSvg.setAttribute('width', (bounds.w + 2 * MARGIN).toString());
      clonedSvg.setAttribute('height', (bounds.h + 2 * MARGIN).toString());

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      downloadSVG(svgData, 'diagram.svg');
    };
    run();
  }
}
