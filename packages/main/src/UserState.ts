import { EventEmitter } from '@diagram-craft/utils/event';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';

type UserStateEvents = {
  change: { after: UserState };
};

export type ThemePreference = 'system' | 'dark' | 'light';
export type EffectiveTheme = 'dark' | 'light';
export type ThemeMode = EffectiveTheme; // Deprecated: Use ThemePreference instead
export type PickerViewMode = 'grid' | 'list';

const DEFAULT_STENCILS = [{ id: 'default', isOpen: true }];

const MAX_RECENT_FILES = 10;
const MAX_PERSISTED_DOCUMENT_TABS = 10;

export const getDocumentTabKey = (url: string | undefined, fallbackDiagramId: string | undefined) =>
  url ?? `untitled:${fallbackDiagramId ?? 'default'}`;

export class UserState extends EventEmitter<UserStateEvents> {
  #panelLeft?: number;
  #panelRight?: number;
  #panelLeftWidth: number = 248;
  #panelRightWidth: number = 248;
  #showHelp: boolean = true;
  #showRulers: boolean = true;
  #stencils: Array<{ id: string; isOpen?: boolean }> = DEFAULT_STENCILS;
  #stencilPickerViewMode: PickerViewMode = 'grid';
  #stencilSearchAllPackages: boolean = true;
  #recentFiles: Array<string>;
  #themePreference: ThemePreference = 'system';
  #effectiveTheme: EffectiveTheme = 'dark';
  #toolWindowTabs: Record<string, string> = {};
  #mediaQueryList: MediaQueryList | undefined;
  #documentTabs: Array<{ documentKey: string; tabId: string }> = [];
  #persistedState: string;

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
    this.#panelLeftWidth = state.panelLeftWidth ?? 248;
    this.#panelRightWidth = state.panelRightWidth ?? 248;
    this.#showHelp = state.showHelp ?? true;
    this.#showRulers = state.showRulers ?? true;
    this.#stencils =
      state.stencils?.map((stencil: { id: string; isOpen?: boolean }) => ({
        ...stencil,
        id: stencil.id === 'basic-shapes' ? 'default' : stencil.id
      })) ?? DEFAULT_STENCILS;
    this.#stencilPickerViewMode = state.stencilPickerViewMode === 'list' ? 'list' : 'grid';
    this.#stencilSearchAllPackages = state.stencilSearchAllPackages ?? true;
    this.#recentFiles = state.recentFiles ?? [];

    // Handle theme preference with backward compatibility
    const storedTheme = state.themePreference ?? state.themeMode;
    if (storedTheme === 'light' || storedTheme === 'dark') {
      this.#themePreference = storedTheme;
    } else {
      this.#themePreference = 'system';
    }

    // Compute effective theme and set up listener
    this.#effectiveTheme = this.computeEffectiveTheme();
    this.setupMediaQueryListener();

    this.#toolWindowTabs = state.toolWindowTabs ?? {};
    this.#documentTabs = state.documentTabs ?? [];
    this.#persistedState = this.serializeState();
  }

  addRecentFile(file: string) {
    this.recentFiles = [file, ...this.recentFiles.filter(f => f !== file)].slice(
      0,
      MAX_RECENT_FILES
    );
  }

  set recentFiles(recentFiles: Array<string>) {
    this.#recentFiles = recentFiles;
    this.triggerChange();
  }

  get recentFiles(): Array<string> {
    return this.#recentFiles;
  }

  // Backward compatibility - deprecated
  set themeMode(themeMode: ThemeMode) {
    this.themePreference = themeMode;
  }

  // Backward compatibility - deprecated
  get themeMode(): ThemeMode {
    return this.#effectiveTheme;
  }

  set themePreference(preference: ThemePreference) {
    if (this.#themePreference === preference) return;
    this.#themePreference = preference;

    const newEffectiveTheme = this.computeEffectiveTheme();
    if (newEffectiveTheme !== this.#effectiveTheme) {
      this.#effectiveTheme = newEffectiveTheme;
    }

    this.setupMediaQueryListener();
    this.triggerChange();
  }

  get themePreference(): ThemePreference {
    return this.#themePreference;
  }

  get effectiveTheme(): EffectiveTheme {
    return this.#effectiveTheme;
  }

  private computeEffectiveTheme(): EffectiveTheme {
    if (this.#themePreference === 'system') {
      // Guard for environments without window (e.g., tests)
      if (typeof window === 'undefined' || !window.matchMedia) {
        return 'dark'; // Default fallback
      }
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return this.#themePreference;
  }

  private setupMediaQueryListener() {
    // Guard for environments without window
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }

    // Clean up existing listener
    if (this.#mediaQueryList) {
      this.#mediaQueryList.removeEventListener('change', this.handleMediaQueryChange);
    }

    // Only listen to system preference changes when in 'system' mode
    if (this.#themePreference === 'system') {
      this.#mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
      this.#mediaQueryList.addEventListener('change', this.handleMediaQueryChange);
    } else {
      this.#mediaQueryList = undefined;
    }
  }

  private handleMediaQueryChange = (e: MediaQueryListEvent) => {
    const newEffectiveTheme: EffectiveTheme = e.matches ? 'dark' : 'light';
    if (newEffectiveTheme !== this.#effectiveTheme) {
      this.#effectiveTheme = newEffectiveTheme;
      this.triggerChange();
    }
  };

  destroy() {
    if (this.#mediaQueryList) {
      this.#mediaQueryList.removeEventListener('change', this.handleMediaQueryChange);
      this.#mediaQueryList = undefined;
    }
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

  set panelLeftWidth(width: number) {
    this.#panelLeftWidth = width;
    this.triggerChange();
  }

  get panelLeftWidth(): number {
    return this.#panelLeftWidth;
  }

  set panelRightWidth(width: number) {
    this.#panelRightWidth = width;
    this.triggerChange();
  }

  get panelRightWidth(): number {
    return this.#panelRightWidth;
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

  get stencilPickerViewMode(): PickerViewMode {
    return this.#stencilPickerViewMode;
  }

  set stencilPickerViewMode(stencilPickerViewMode: PickerViewMode) {
    if (this.#stencilPickerViewMode === stencilPickerViewMode) return;
    this.#stencilPickerViewMode = stencilPickerViewMode;
    this.triggerChange();
  }

  get stencilSearchAllPackages(): boolean {
    return this.#stencilSearchAllPackages;
  }

  set stencilSearchAllPackages(stencilSearchAllPackages: boolean) {
    if (this.#stencilSearchAllPackages === stencilSearchAllPackages) return;
    this.#stencilSearchAllPackages = stencilSearchAllPackages;
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

  getDocumentTab(documentKey: string): string | undefined {
    if (CollaborationConfig.isNoOp) return undefined;
    return this.#documentTabs.find(e => e.documentKey === documentKey)?.tabId;
  }

  setDocumentTab(documentKey: string, tabId: string) {
    if (CollaborationConfig.isNoOp) return;
    this.#documentTabs = [
      { documentKey, tabId },
      ...this.#documentTabs.filter(e => e.documentKey !== documentKey)
    ].slice(0, MAX_PERSISTED_DOCUMENT_TABS);
    this.triggerChange();
  }

  private triggerChange() {
    const persistedState = this.serializeState();
    if (persistedState === this.#persistedState) return;
    this.#persistedState = persistedState;
    localStorage.setItem('diagram-craft.user-state', persistedState);
    this.emit('change', { after: this });
  }

  private serializeState() {
    return JSON.stringify({
      panelLeft: this.#panelLeft,
      panelRight: this.#panelRight,
      panelLeftWidth: this.#panelLeftWidth,
      panelRightWidth: this.#panelRightWidth,
      showHelp: this.#showHelp,
      showRulers: this.#showRulers,
      stencils: this.#stencils,
      stencilPickerViewMode: this.#stencilPickerViewMode,
      stencilSearchAllPackages: this.#stencilSearchAllPackages,
      recentFiles: this.#recentFiles,
      themePreference: this.#themePreference,
      toolWindowTabs: this.#toolWindowTabs,
      documentTabs: this.#documentTabs
    });
  }
}
