import { YJSMap, YJSRoot } from './yjsCrdt';
import * as Y from 'yjs';
import { CollaborationConfig } from '../collaborationConfig';
import { NoOpCRDTMap, NoOpCRDTRoot } from '../noopCrdt';
import { afterEach, beforeEach } from 'vitest';

export const createSyncedYJSCRDTs = () => {
  const doc1 = new YJSRoot();
  const doc2 = new YJSRoot();

  doc1.yDoc.on('update', (update: Uint8Array) => {
    Y.applyUpdate(doc2.yDoc, update);
  });

  doc2.yDoc.on('update', (update: Uint8Array) => {
    Y.applyUpdate(doc1.yDoc, update);
  });
  return { doc1, doc2 };
};

export const setupYJS = () => {
  beforeEach(() => {
    CollaborationConfig.CRDTRoot = YJSRoot;
    CollaborationConfig.CRDTMap = YJSMap;
  });
  afterEach(() => {
    CollaborationConfig.CRDTRoot = NoOpCRDTRoot;
    CollaborationConfig.CRDTMap = NoOpCRDTMap;
  });
};
