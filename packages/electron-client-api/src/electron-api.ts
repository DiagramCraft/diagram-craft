export type Channel = 'menu:action' | 'file:recentFileOpen';

export type ElectronAPI = {
  isElectron: boolean;

  on: (channel: Channel, callback: (value: string) => void) => void;
  removeAllListeners: (channel: Channel) => void;

  platform: string;

  fileOpen: () => Promise<{ url: string } | undefined>;
  fileSave: (url: string, data: string) => Promise<string | undefined>;
  fileSaveAs: (url: string | undefined, data: string) => Promise<string | undefined>;
  fileLoad: (url: string) => Promise<{ content: string } | undefined>;

  setMenu: (items: MenuEntry[], keybindings: Record<string, string>) => void;
  setMenuEntryState: (id: string, state: { enabled: boolean; value?: boolean }) => void;

  getUsername: () => Promise<string>;
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
