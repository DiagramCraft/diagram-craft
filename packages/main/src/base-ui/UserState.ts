import { EventEmitter } from '@diagram-craft/utils';

type UserStateEvents = {
  change: { after: UserState };
};

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;

  constructor() {
    super();
    const state = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
    this.#panelLeft = state.panelLeft;
    this.#panelRight = state.panelRight;
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

  private triggerChange() {
    localStorage.setItem(
      'diagram-craft.user-state',
      JSON.stringify({
        panelLeft: this.#panelLeft,
        panelRight: this.#panelRight
      })
    );
    this.emit('change', { after: this });
  }
}
