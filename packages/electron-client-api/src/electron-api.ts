export type ElectronAPI = {
  isElectron: boolean;
  onMenuAction: (callback: (action: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  platform: string;

  fileOpen: () => Promise<{ url: string } | undefined>;
  fileSave: (url: string, data: string) => Promise<string | undefined>;
  fileSaveAs: (url: string | undefined, data: string) => Promise<string | undefined>;
  fileLoad: (url: string) => Promise<{ content: string } | undefined>;

  setMenu: (items: MenuEntry[], keybindings: Record<string, string>) => void;
  setMenuEntryState: (id: string, state: { enabled: boolean; value?: boolean }) => void;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export interface MenuEntry {
  id: string;
  label: string;
  action?: string;
  type?: 'action' | 'toggle' | 'separator' | 'submenu' | 'dynamic' | 'recent';
  submenu?: MenuEntry[];
  disabled?: boolean;
}
