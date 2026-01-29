import { deserializeDiagramDocument } from '@diagram-craft/model/serialization/deserialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { serializeDiagramDocument } from '@diagram-craft/model/serialization/serialize';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/diagramDocumentFactory';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import { MULTI_WINDOW_DETECTOR } from './MultiWindowDetector';
import type { ProgressCallback } from '@diagram-craft/utils/progress';
import type { CRDTRoot } from '@diagram-craft/collaboration/crdt';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';

const MAX_AUTOSAVES_PER_WINDOW = 3;
const MAX_TOTAL_AUTOSAVES = 20;
const AUTOSAVE_RETENTION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

type AutosaveEntry = {
  windowId: string;
  timestamp: number;
  url?: string;
  diagram: SerializedDiagramDocument;
};

type AutosaveStorage = {
  entries: AutosaveEntry[];
  version: number;
};

let needsSave:
  | {
      url: string | undefined;
      doc: DiagramDocument;
      callback?: (d: SerializedDiagramDocument) => void;
    }
  | undefined;

const AUTOSAVE_KEY = 'autosave-multi-window';

const AutosaveStorage = {
  get(): AutosaveStorage {
    const stored = localStorage.getItem(AUTOSAVE_KEY);
    if (!stored) return { entries: [], version: 1 };

    const parsed = JSON.parse(stored);
    return {
      entries: parsed.entries ?? [],
      version: parsed.version ?? 1
    };
  },

  save(storage: AutosaveStorage): void {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(storage));
    } catch {
      // localStorage might be full or unavailable
      // Try to clean up old entries and retry
      const reducedStorage = {
        ...storage,
        entries: storage.entries.slice(0, Math.floor(MAX_TOTAL_AUTOSAVES / 2))
      };
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(reducedStorage));
    }
  }
};

export const MultiWindowAutosave = {
  /**
   * Load autosave data using multi-window aware algorithm
   */
  load: async (
    root: CRDTRoot,
    progressCallback: ProgressCallback,
    documentFactory: DocumentFactory,
    diagramFactory: DiagramFactory,
    failSilently = false
  ): Promise<{ document: DiagramDocument; url?: string } | undefined> => {
    if (!CollaborationConfig.isNoOp) return undefined;

    try {
      const storage = AutosaveStorage.get();
      if (storage.entries.length === 0) return undefined;

      const currentWindowId = MULTI_WINDOW_DETECTOR.getCurrentWindowId();

      // Sort entries by timestamp (newest first)
      const sortedEntries = [...storage.entries].sort((a, b) => b.timestamp - a.timestamp);

      // Strategy: Find the most appropriate autosave for this window
      // 1. First check if we have an autosave for this exact window ID
      // 2. Then find any "free" autosave from inactive windows
      // 3. Prefer the newest free autosave

      // First, check if we already have an autosave for this specific window ID
      const entry = sortedEntries.find(entry => entry.windowId === currentWindowId);
      if (entry) {
        const doc = await documentFactory.createDocument(root, entry.url, progressCallback);
        await deserializeDiagramDocument(entry.diagram, doc, diagramFactory);
        await doc.load();

        return {
          document: doc,
          url: entry.url
        };
      }

      // Give BroadcastChannel a moment to detect other windows
      await new Promise(resolve => setTimeout(resolve, 200));

      // Find potentially free autosaves (from inactive windows) sorted by newest first
      const potentiallyFreeEntries = sortedEntries.filter(entry => {
        const isActive = MULTI_WINDOW_DETECTOR.isWindowActive(entry.windowId);
        return !isActive;
      });

      if (potentiallyFreeEntries.length === 0) return undefined;

      // Use the newest potentially free autosave
      const selectedEntry = potentiallyFreeEntries[0]!; // Already sorted newest first

      // Only clean up autosaves that are old (beyond retention time) AND inactive
      const now = Date.now();
      const entriesToCleanup = storage.entries.filter(entry => {
        const age = now - entry.timestamp;
        const isActive = MULTI_WINDOW_DETECTOR.isWindowActive(entry.windowId);
        const isOld = age > AUTOSAVE_RETENTION_TIME;

        return isOld && !isActive;
      });

      // IMMEDIATELY claim the free autosave by updating its window ID to prevent race conditions
      const claimedEntry: AutosaveEntry = {
        ...selectedEntry,
        windowId: currentWindowId,
        timestamp: Date.now() // Update timestamp to show it's now owned by this window
      };

      // Update storage with claimed entry and cleanup
      const updatedEntries = storage.entries
        .map(entry => (entry === selectedEntry ? claimedEntry : entry))
        .filter(entry => !entriesToCleanup.includes(entry));

      AutosaveStorage.save({ ...storage, entries: updatedEntries });

      // Load the selected autosave
      const doc = await documentFactory.createDocument(root, selectedEntry.url, progressCallback);
      await deserializeDiagramDocument(selectedEntry.diagram, doc, diagramFactory);
      await doc.load();

      return { document: doc, url: selectedEntry.url };
    } catch (e) {
      if (!failSilently) throw e;

      console.warn('Failed to load autosaved document', e);
      MultiWindowAutosave.clear();
      return undefined;
    }
  },

  /**
   * Save autosave data for the current window
   */
  save: async (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ): Promise<void> => {
    if (!CollaborationConfig.isNoOp) return;

    try {
      const diagram = await serializeDiagramDocument(doc);
      if (callback) callback(diagram);

      const storage = AutosaveStorage.get();
      const windowId = MULTI_WINDOW_DETECTOR.getCurrentWindowId();

      // Remove existing autosaves for this window
      const otherWindowEntries = storage.entries.filter(e => e.windowId !== windowId);

      // Add new autosave entry
      const newEntry: AutosaveEntry = { windowId, timestamp: Date.now(), url, diagram };

      // Get existing entries for this window, keep only the most recent ones
      const thisWindowEntries = storage.entries
        .filter(e => e.windowId === windowId)
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_AUTOSAVES_PER_WINDOW - 1); // -1 to make room for new entry

      // Limit total number of autosaves
      const limitedEntries = [newEntry, ...thisWindowEntries, ...otherWindowEntries]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_TOTAL_AUTOSAVES);

      AutosaveStorage.save({
        entries: limitedEntries,
        version: 1
      });
    } catch (e) {
      console.warn('Failed to autosave', e);
    }
  },

  /**
   * Check if any autosave exists
   */
  exists: async (): Promise<boolean> => {
    const storage = AutosaveStorage.get();
    return storage.entries.length > 0;
  },

  /**
   * Clear all autosave data
   */
  clear: (): void => {
    localStorage.removeItem(AUTOSAVE_KEY);
  },

  /**
   * Clean up autosaves from inactive windows (only if they're old enough)
   */
  cleanupInactiveWindows: (): void => {
    const storage = AutosaveStorage.get();
    const now = Date.now();

    const retainedEntries = storage.entries.filter(entry => {
      const age = now - entry.timestamp;
      const isActive = MULTI_WINDOW_DETECTOR.isWindowActive(entry.windowId);
      const isOld = age > AUTOSAVE_RETENTION_TIME;

      // Keep entries that are either active OR not old enough
      return isActive || !isOld;
    });

    const cleanedCount = storage.entries.length - retainedEntries.length;
    if (cleanedCount > 0) {
      AutosaveStorage.save({ ...storage, entries: retainedEntries });
    }
  },

  /**
   * Async save (queued)
   */
  asyncSave: (
    url: string | undefined,
    doc: DiagramDocument,
    callback?: (d: SerializedDiagramDocument) => void
  ): void => {
    needsSave = { url, doc, callback };
  },

  init: () => {
    // Background save interval
    setInterval(() => {
      if (needsSave) {
        MultiWindowAutosave.save(needsSave.url, needsSave.doc, needsSave.callback);
        needsSave = undefined;
      }
    }, 1000);

    // Background cleanup interval - clean up autosaves from inactive windows every 30 seconds
    setInterval(() => MultiWindowAutosave.cleanupInactiveWindows(), 30000);
  }
};
