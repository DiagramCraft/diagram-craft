import { Diagram } from '@diagram-craft/model/diagram';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { assert } from '@diagram-craft/utils/assert';

declare global {
  interface StencilLoaderOpts {}
}

export type StencilLoader<T extends keyof StencilLoaderOpts> = (
  diagram: Diagram,
  opts: StencilLoaderOpts[T]
) => void;

export const stencilLoaderRegistry: Partial<{
  [K in keyof StencilLoaderOpts]: () => Promise<StencilLoader<K>>;
}> = {};

export type FileLoader = (
  // TODO: Need to extend with blob
  content: string,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory<Diagram>
) => Promise<DiagramDocument>;

export const fileLoaderRegistry: Record<string, () => Promise<FileLoader>> = {};

/* Now some utilities to make it easier to use the FileLoader infrastructure */

export const getFileLoaderForUrl = (url: string) => {
  const ext = url.split('.').pop();
  return fileLoaderRegistry[`.${ext}`];
};

export const loadFileFromUrl = async (
  url: string,
  documentFactory: DocumentFactory,
  diagramFactory: DiagramFactory<Diagram>
) => {
  const fileLoader = getFileLoaderForUrl(url);
  assert.present(fileLoader, `File loader for ${url} not found`);

  return fileLoader().then(loader =>
    fetch(url)
      .then(r => r.text())
      .then(c => loader(c, documentFactory, diagramFactory))
  );
};
