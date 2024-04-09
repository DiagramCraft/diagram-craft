import { EventEmitter } from '@diagram-craft/utils';

export type ToolType = 'move' | 'text' | 'edge' | 'node' | 'pen';

type ApplicationStateEvents = {
  toolChange: { tool: ToolType };
  hoverElementChange: { element: string | undefined };
};

export class ApplicationState extends EventEmitter<ApplicationStateEvents> {
  #tool: ToolType = 'move';
  #hoverElement: string | undefined = undefined;

  constructor() {
    super();
  }

  set tool(tool: ToolType) {
    this.#tool = tool;
    this.emit('toolChange', { tool });
  }

  get tool(): ToolType {
    return this.#tool;
  }

  // TODO: Remove hoveElement - doesn't seem to be used
  set hoverElement(element: string | undefined) {
    this.#hoverElement = element;
    this.emit('hoverElementChange', { element });
  }

  get hoverElement(): string | undefined {
    return this.#hoverElement;
  }
}
