import { ActionConstructionParameters } from '@diagram-craft/canvas/keyMap';
import { AbstractAction } from '@diagram-craft/canvas/action';
import { Diagram } from '@diagram-craft/model/diagram';
import { Box } from '@diagram-craft/geometry/box';
import { blobToDataURL } from '@diagram-craft/model/attachment';

export const exportActions = (state: ActionConstructionParameters) => ({
  FILE_EXPORT_IMAGE: new ExportImageAction(state.diagram)
});

declare global {
  interface ActionMap extends ReturnType<typeof exportActions> {}
}

const downloadImage = (data: string, filename = 'untitled.png') => {
  const a = document.createElement('a');
  a.href = data;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
};

const MARGIN = 50;
const SCALE = 2;

class ExportImageAction extends AbstractAction {
  constructor(private readonly diagram: Diagram) {
    super();
  }

  execute(): void {
    const run = async () => {
      const bounds = Box.boundingBox(this.diagram.visibleElements().map(e => e.bounds));

      const clonedSvg = document
        .getElementById(`diagram-${this.diagram.id}`)!
        .cloneNode(true) as HTMLElement;
      clonedSvg.setAttribute('width', bounds.w.toString());
      clonedSvg.setAttribute('height', bounds.h.toString());

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
      for (const [, a] of this.diagram.document.attachments.attachments) {
        const dataUrl = await a.getDataUrl();
        clonedSvg.querySelectorAll('image[href="' + a.url + '"]').forEach(e => {
          e.setAttribute('href', dataUrl);
        });
      }

      // Download and embed all external images
      for (const [, img] of clonedSvg.querySelectorAll('image').entries()) {
        const href = img.href.baseVal;
        if (href.startsWith('data:')) continue;

        console.log('Downloading ' + href);

        const connection = await fetch(href);
        const data = await connection.blob();
        img.setAttribute('href', await blobToDataURL(data));

        console.log('... done');
      }

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

      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData))); //btoa(svgData);

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
