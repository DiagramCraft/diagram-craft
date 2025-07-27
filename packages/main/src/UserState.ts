import { EventEmitter } from '@diagram-craft/utils/event';
import { AppConfig } from './appConfig';

type UserStateEvents = {
  change: { after: UserState };
};

const DEFAULT_STENCILS = [{ id: 'basic-shapes', isOpen: true }];

const MAX_RECENT_FILES = 10;

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;
  #showHelp: boolean = true;
  #stencils: Array<{ id: string; isOpen?: boolean }> = DEFAULT_STENCILS;
  #recentFiles: Array<string>;

  private static instance: UserState | undefined;

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
    this.#recentFiles = state.recentFiles ?? [];
  }

  addRecentFile(file: string) {
    this.recentFiles = [file, ...this.recentFiles.filter(f => f !== file)].slice(
      0,
      MAX_RECENT_FILES
    );
  }

  get awarenessState() {
    const config = AppConfig.get();
    return {
      name: config.awareness.name(),
      color: config.awareness.color()
    };
  }

  set recentFiles(recentFiles: Array<string>) {
    this.#recentFiles = recentFiles;
    this.triggerChange();
  }

  get recentFiles(): Array<string> {
    return this.#recentFiles;
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
        stencils: this.#stencils,
        recentFiles: this.#recentFiles
      })
    );
    this.emit('change', { after: this });
  }
}
