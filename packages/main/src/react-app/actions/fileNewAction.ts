import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';
import { assert } from '@diagram-craft/utils/assert';

export const fileNewActions = (application: Application) => ({
  FILE_NEW: new FileNewAction(application)
});

declare global {
  interface ActionMap extends ReturnType<typeof fileNewActions> {}
}

class FileNewAction extends AbstractAction<undefined, Application> {
  constructor(application: Application) {
    super(application);
  }

  execute(): void {
    const margin = 30;

    const svgElement = document.getElementById(
      `diagram-${this.context.model.activeDiagram.id}`
    ) as unknown as SVGSVGElement | undefined;
    assert.present(svgElement);

    const rulerEl = document.getElementById(`ruler-v`);
    const toolbarEl = document.getElementById(`toolbar`);
    assert.present(toolbarEl);

    // TODO: Needs a better, less brittle, way of handling this
    const rightIndent = Number(getComputedStyle(toolbarEl).marginRight.replace('px', ''));
    const leftIndent = Number(getComputedStyle(toolbarEl).marginLeft.replace('px', ''));

    const availableWidth = svgElement.clientWidth - (leftIndent + rightIndent) - margin * 2;
    const availableHeight = svgElement.clientHeight - margin * 2;

    const rulerWidth = rulerEl ? Number(getComputedStyle(rulerEl!).width.replace('px', '')) : 0;

    const offset = { x: -(margin + rulerWidth / 2) - leftIndent, y: -(margin + rulerWidth / 2) };

    this.context.file.newDocument(
      {
        w: availableWidth,
        h: availableHeight
      },
      offset
    );
  }
}
