import { EventEmitter } from '@diagram-craft/utils/event';

type Help = {
  id: string;
  message: string;
};

type HelpStateEvents = {
  helpChange: { help: Help | undefined };
};

export class HelpState extends EventEmitter<HelpStateEvents> {
  #help: Array<Help> = [];

  pushHelp(help: Help | undefined) {
    if (!this.#help.find(h => h.id === help?.id)) {
      this.#help.push(help!);
    } else if (this.#help.at(-1)!.id === help?.id) {
      this.#help.pop();
      this.#help.push(help);
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
