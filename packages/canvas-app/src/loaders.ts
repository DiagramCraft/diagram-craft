import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { assert } from '@diagram-craft/utils/assert';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { ProgressCallback } from '@diagram-craft/model/types';
import type { CRDTRoot } from '@diagram-craft/model/collaboration/crdt';
import type { DiagramFactory, DocumentFactory } from '@diagram-craft/model/factory';

declare global {
  interface StencilLoaderOpts {}
}

export type StencilLoader<T extends keyof StencilLoaderOpts> = (
  nodeDefinition: NodeDefinitionRegistry,
  opts: StencilLoaderOpts[T]
) => Promise<void>;

export const stencilLoaderRegistry: Partial<{
  [K in keyof StencilLoaderOpts]: () => Promise<StencilLoader<K>>;
}> = {};

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
  progressCallback: ProgressCallback,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory,
  root?: CRDTRoot
) => {
  const content = await fetch(url).then(r => r.text());

  const fileLoaderFactory = getFileLoaderForUrl(url);
  assert.present(fileLoaderFactory, `File loader for ${url} not found`);
  const fileLoader = await fileLoaderFactory();

  root ??= await documentFactory.loadCRDT(url, progressCallback);
  const doc = await documentFactory.createDocument(root, url, progressCallback);
  await fileLoader(content, doc, diagramFactory);
  await doc.load();

  return doc;
};
