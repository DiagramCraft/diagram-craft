import * as Y from 'yjs';
import type { Releasable } from '@diagram-craft/utils/releasable';

const activeOrigins = new WeakMap<Y.Doc, unknown[]>();

const getOrigins = (doc: Y.Doc) => {
  let origins = activeOrigins.get(doc);
  if (!origins) {
    origins = [];
    activeOrigins.set(doc, origins);
  }
  return origins;
};

export const getActiveYjsUndoOrigin = (doc: Y.Doc) => {
  return getOrigins(doc).at(-1);
};

export const openYjsUndoOriginSession = (doc: Y.Doc, origin: unknown): Releasable => {
  const origins = getOrigins(doc);
  origins.push(origin);

  let released = false;
  return {
    release() {
      if (released) return;
      released = true;

      const currentOrigins = getOrigins(doc);
      const idx = currentOrigins.lastIndexOf(origin);
      if (idx >= 0) {
        currentOrigins.splice(idx, 1);
      }
    }
  };
};
