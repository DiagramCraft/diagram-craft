import { newid } from '@diagram-craft/utils/id';
import { assert } from '@diagram-craft/utils/assert';

const WINDOW_ID = 'diagram-craft-window-id';
const CurrentWindowId = {
  get: () => sessionStorage.getItem(WINDOW_ID),
  save: (windowId: string) => sessionStorage.setItem(WINDOW_ID, windowId)
};

const PERSISTENT_WINDOW_LIST = 'diagram-craft-active-windows';
const PersistentWindowList = {
  remove(windowId: string) {
    const persistedWindows = this.get();
    delete persistedWindows[windowId];
    localStorage.setItem(PERSISTENT_WINDOW_LIST, JSON.stringify(persistedWindows));
  },

  cleanup(): void {
    const now = Date.now();

    const cleanedWindows: Record<string, number> = Object.fromEntries(
      Object.entries(this.get()).filter(([_, timestamp]) => now - timestamp < 10000)
    );

    localStorage.setItem(PERSISTENT_WINDOW_LIST, JSON.stringify(cleanedWindows));
  },

  update(windowId: string): void {
    const existingWindows = PersistentWindowList.get();

    // Only update the current window's timestamp, don't touch others
    existingWindows[windowId] = Date.now();
    localStorage.setItem(PERSISTENT_WINDOW_LIST, JSON.stringify(existingWindows));

    PersistentWindowList.cleanup();
  },

  get(): Record<string, number> {
    try {
      const stored = localStorage.getItem(PERSISTENT_WINDOW_LIST);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }
};

/**
 * Multi-window detector using BroadcastChannel API
 * Detects multiple browser windows/tabs of the same site from the same browser
 */
class MultiWindowDetector {
  private readonly channel: BroadcastChannel | undefined;
  private readonly windowId: string;
  private windows = new Set<string>();
  private heartbeatInterval: number | undefined;

  constructor(channelName = 'diagram-craft-windows') {
    // Try to get existing window ID from sessionStorage first (survives refresh)
    this.windowId = CurrentWindowId.get() ?? `window-${newid()}`;
    CurrentWindowId.save(this.windowId);

    PersistentWindowList.cleanup();

    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(channelName);
      this.setupChannel();
    }

    PersistentWindowList.update(this.windowId);
    this.heartbeatInterval = window.setInterval(
      () => PersistentWindowList.update(this.windowId),
      5000
    );
  }

  private setupChannel(): void {
    assert.present(this.channel);

    this.channel.addEventListener('message', event => {
      const { type, windowId } = event.data;

      switch (type) {
        case 'ping':
          this.windows.add(windowId);
          this.channel!.postMessage({ type: 'pong', windowId: this.windowId });
          break;
        case 'pong':
          this.windows.add(windowId);
          break;
        case 'goodbye':
          this.windows.delete(windowId);
          break;
      }
    });

    // Announce our presence
    this.channel.postMessage({ type: 'ping', windowId: this.windowId });

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
  }

  /**
   * Check if a specific window ID is currently active
   * This includes both currently detected windows and recently active windows
   */
  isWindowActive(windowId: string): boolean {
    if (windowId === this.windowId) return true;
    if (this.windows.has(windowId)) return true;

    // Check persisted state for recently active windows (within last 10 seconds)
    const persistedWindows = PersistentWindowList.get();
    const windowTimestamp = persistedWindows[windowId];

    return !!(windowTimestamp && Date.now() - windowTimestamp < 10000);
  }

  /**
   * Get the current window's ID
   */
  getCurrentWindowId(): string {
    return this.windowId;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.channel) {
      this.channel.postMessage({ type: 'goodbye', windowId: this.windowId });
      this.channel.close();
    }

    PersistentWindowList.remove(this.windowId);
  }
}

// Singleton instance
export const MULTI_WINDOW_DETECTOR = new MultiWindowDetector();
