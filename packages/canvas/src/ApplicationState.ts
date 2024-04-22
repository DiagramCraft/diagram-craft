import { EventEmitter } from '@diagram-craft/utils/event';

declare global {
  interface Tools {}
}

export type ToolType = keyof Tools;

type Help = {
  id: string;
  message: string;
};

type ApplicationStateEvents = {
  toolChange: { tool: ToolType };
  hoverElementChange: { element: string | undefined };
  helpChange: { help: Help | undefined };
};

export class ApplicationState extends EventEmitter<ApplicationStateEvents> {
  #tool: ToolType = 'move';
  #hoverElement: string | undefined = undefined;
  #help: Array<Help> = [];

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

  set hoverElement(element: string | undefined) {
    this.#hoverElement = element;
    this.emit('hoverElementChange', { element });
  }

  get hoverElement(): string | undefined {
    return this.#hoverElement;
  }

  pushHelp(help: Help | undefined) {
    if (!this.#help.find(h => h.id === help?.id)) {
      this.#help.push(help!);
    } else if (this.#help.at(-1)!.id === help?.id) {
      this.#help.pop();
      this.#help.push(help!);
    } else {
      // Ignore
    }
    this.emit('helpChange', { help });
  }

  get help(): Help | undefined {
    return this.#help.length === 0 ? undefined : this.#help.at(-1);
  }

  popHelp(id: string) {
    if (this.#help.length > 0 && this.#help.at(-1)!.id === id) {
      this.#help.pop();
      this.emit('helpChange', { help: this.#help.at(-1) });
    }
  }

  setHelp(help: Help) {
    this.#help = [help];
    this.emit('helpChange', { help: this.#help.at(-1) });
  }
}
