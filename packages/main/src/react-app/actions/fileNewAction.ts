import { AbstractAction } from '@diagram-craft/canvas/action';
import { Application } from '../../application';

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
    const svgElement = document.getElementById(
      `diagram-${this.context.model.activeDiagram.id}`
    ) as unknown as SVGSVGElement | undefined;
    const availableWidth = svgElement ? svgElement.clientWidth - 60 : window.innerWidth - 60;
    const availableHeight = svgElement ? svgElement.clientHeight - 60 : window.innerHeight - 60;

    this.context.file.newDocument({
      w: availableWidth,
      h: availableHeight
    });
  }
}
