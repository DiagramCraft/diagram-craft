export type ElectronAPI = {
  isElectron: boolean;
  onMenuAction: (callback: (action: string) => void) => void;
  removeAllListeners: (channel: string) => void;
  platform: string;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fileOpen: () => Promise<any>;
};

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
