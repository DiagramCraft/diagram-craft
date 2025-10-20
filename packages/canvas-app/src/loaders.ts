import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { assert } from '@diagram-craft/utils/assert';
import { ProgressCallback } from '@diagram-craft/model/types';
import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';
import type { AwarenessUserState } from '@diagram-craft/model/collaboration/awareness';

export type FileLoader = (
  // TODO: Need to extend with blob
  content: string,
  doc: DiagramDocument,
  diagramFactory: DiagramFactory
) => Promise<void>;

export const fileLoaderRegistry: Record<string, () => Promise<FileLoader>> = {};

/* Now some utilities to make it easier to use the FileLoader infrastructure */

export const getFileLoaderForUrl = (url: string) => {
  const ext = url.split('.').pop();
  return fileLoaderRegistry[`.${ext}`];
};

export const loadFileFromUrl = async (
  url: string,
  userState: AwarenessUserState,
  progressCallback: ProgressCallback,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory,
  opts?: {
    root?: CRDTRoot;
  }
) => {
  const content = await FileSystem.loadFromUrl(url);

  const fileLoaderFactory = getFileLoaderForUrl(url);
  assert.present(fileLoaderFactory, `File loader for ${url} not found`);
  const fileLoader = await fileLoaderFactory();

  const root = opts?.root ?? (await documentFactory.loadCRDT(url, userState, progressCallback));
  const doc = await documentFactory.createDocument(root, url, progressCallback);
  await fileLoader(content, doc, diagramFactory);
  await doc.load();

  return doc;
};

export const FileSystem = {
  loadFromUrl: async (url: string) => fetch(url.replace('$STENCIL_ROOT', '')).then(r => r.text())
};
