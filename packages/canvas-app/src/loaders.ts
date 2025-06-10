import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { assert } from '@diagram-craft/utils/assert';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { ProgressCallback } from '@diagram-craft/model/types';

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
  diagramFactory: DiagramFactory<Diagram>
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
  diagramFactory: DiagramFactory<Diagram>
) => {
  const content = await fetch(url).then(r => r.text());

  const fileLoaderFactory = getFileLoaderForUrl(url);
  assert.present(fileLoaderFactory, `File loader for ${url} not found`);
  const fileLoader = await fileLoaderFactory();

  const doc = await documentFactory(url, progressCallback);
  await fileLoader(content, doc, diagramFactory);
  await doc.load();

  return doc;
};
