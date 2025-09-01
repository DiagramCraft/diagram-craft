export type ElectronAPI = {
  isElectron: boolean;
  onMenuAction: (callback: (action: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  platform: string;

  fileOpen: () => Promise<{ url: string } | undefined>;
  fileSave: (url: string, data: string) => Promise<string | undefined>;
  fileSaveAs: (url: string | undefined, data: string) => Promise<string | undefined>;
  fileLoad: (url: string) => Promise<{ content: string } | undefined>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
