import { EventEmitter } from '@diagram-craft/utils/event';

type UserStateEvents = {
  change: { after: UserState };
};

const DEFAULT_STENCILS = [{ id: 'basic-shapes', isOpen: true }];

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;
  #showHelp: boolean = true;
  #stencils: Array<{ id: string; isOpen?: boolean }> = DEFAULT_STENCILS;

  private static instance: UserState;

  static get() {
    if (!UserState.instance) {
      UserState.instance = new UserState();
    }
    return UserState.instance;
  }

  constructor() {
    super();
    const state = JSON.parse(localStorage.getItem('diagram-craft.user-state') ?? '{}');
    this.#panelLeft = state.panelLeft;
    this.#panelRight = state.panelRight;
    this.#showHelp = state.showHelp;
    this.#stencils = state.stencils ?? DEFAULT_STENCILS;
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

  get stencils() {
    return this.#stencils;
  }

  setStencils(stencils: Array<{ id: string; isOpen?: boolean }>) {
    this.#stencils = stencils;
    this.triggerChange();
  }

  private triggerChange() {
    localStorage.setItem(
      'diagram-craft.user-state',
      JSON.stringify({
        panelLeft: this.#panelLeft,
        panelRight: this.#panelRight,
        showHelp: this.#showHelp,
        stencils: this.#stencils
      })
    );
    this.emit('change', { after: this });
  }
}
