export type ElectronAPI = {
  isElectron: boolean;
  onMenuAction: (callback: (action: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  platform: string;

  fileOpen: () => Promise<{ url: string; content: string } | undefined>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
