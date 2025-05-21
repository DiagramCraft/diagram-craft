import { YJSRoot } from './yjsCrdt';
import * as Y from 'yjs';

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
