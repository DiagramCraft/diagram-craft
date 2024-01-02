import { EventEmitter } from '../utils/event.ts';

export type ToolType = 'move' | 'text' | 'edge';

type ApplicationStateEvents = {
  toolChange: { tool: ToolType };
};

export class ApplicationState extends EventEmitter<ApplicationStateEvents> {
  #tool: ToolType = 'move';

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
}
