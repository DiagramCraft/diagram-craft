import { EventEmitter } from '@diagram-craft/utils/event';
import { AppConfig } from './appConfig';
import type { AwarenessUserState } from '@diagram-craft/model/collaboration/awareness';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';

type UserStateEvents = {
  change: { after: UserState };
};

const DEFAULT_STENCILS = [{ id: 'basic-shapes', isOpen: true }];

const MAX_RECENT_FILES = 10;

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;
  #showHelp: boolean = true;
  #showRulers: boolean = true;
  #stencils: Array<{ id: string; isOpen?: boolean }> = DEFAULT_STENCILS;
  #recentFiles: Array<string>;
  #toolWindowTabs: Record<string, string> = {};

  private awarenessStateCache: AwarenessUserState | undefined;

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
    this.#toolWindowTabs = state.toolWindowTabs ?? {};
  }

  addRecentFile(file: string) {
    this.recentFiles = [file, ...this.recentFiles.filter(f => f !== file)].slice(
      0,
      MAX_RECENT_FILES
    );
  }

  get awarenessState() {
    const config = AppConfig.get();
    if (!this.awarenessStateCache) {
      this.awarenessStateCache = {
        name: config.awareness.name(),
        color: config.awareness.color()
      };
    }
    return this.awarenessStateCache!;
  }

  set awarenessState(state: AwarenessUserState) {
    this.awarenessStateCache = state;
    CollaborationConfig.Backend.awareness?.updateUser(state);
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

  get showRulers() {
    return this.#showRulers;
  }

  set showRulers(showRulers: boolean) {
    this.#showRulers = showRulers;
    this.triggerChange();
  }

  getToolWindowTab(windowId: string): string | undefined {
    return this.#toolWindowTabs[windowId];
  }

  setToolWindowTab(windowId: string, tabId: string) {
    this.#toolWindowTabs[windowId] = tabId;
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
        recentFiles: this.#recentFiles,
        toolWindowTabs: this.#toolWindowTabs
      })
    );
    this.emit('change', { after: this });
  }
}
