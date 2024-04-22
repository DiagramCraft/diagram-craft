import { EventEmitter } from '@diagram-craft/utils/event';

type UserStateEvents = {
  change: { after: UserState };
};

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;
  #showHelp: boolean = true;

  constructor() {
    super();
    const state = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
    this.#panelLeft = state.panelLeft;
    this.#panelRight = state.panelRight;
    this.#showHelp = state.showHelp;
  }

  set panelLeft(panelLeft: number | undefined) {
    this.#panelLeft = panelLeft;
    this.triggerChange();
  }

  get panelLeft(): number | undefined {
    return this.#panelLeft;
  }

  set panelRight(panelRight: number | undefined) {
    this.#panelRight = panelRight;
    this.triggerChange();
  }

  get panelRight(): number | undefined {
    return this.#panelRight;
  }

  set showHelp(showHelp: boolean) {
    this.#showHelp = showHelp;
    this.triggerChange();
  }

  get showHelp(): boolean {
    return this.#showHelp;
  }

  private triggerChange() {
    localStorage.setItem(
      'diagram-craft.user-state',
      JSON.stringify({
        panelLeft: this.#panelLeft,
        panelRight: this.#panelRight,
        showHelp: this.#showHelp
      })
    );
    this.emit('change', { after: this });
  }
}
