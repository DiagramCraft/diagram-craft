import { FileLoader, StencilLoader } from '@diagram-craft/canvas-app/loaders';
import { drawioReader } from './drawioReader';
import { NodeDefinitionRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { loadDrawioStencils, toRegularStencil } from './drawioStencilLoader';

declare global {
  interface StencilLoaderOpts {
    drawioManual: {
      callback: () => Promise<(def: NodeDefinitionRegistry) => Promise<void>>;
    };
    drawioXml: {
      name: string;
      url: string;
      foreground: string;
      background: string;
    };
  }
}

export const stencilLoaderDrawioManual: StencilLoader<'drawioManual'> = async (
  nodeDefinitions,
  opts
) => {
  await (
    await opts.callback()
  )(nodeDefinitions);
};

export const stencilLoaderDrawioXml: StencilLoader<'drawioXml'> = async (nodeDefinitions, opts) => {
  const { name, url, foreground, background } = opts;
  const drawioStencils = await loadDrawioStencils(url, name, foreground, background);

  const stencilRegistry = nodeDefinitions.stencilRegistry;
  stencilRegistry.register({
    id: name,
    name: name,
    stencils: drawioStencils.map(toRegularStencil)
  });
  stencilRegistry.activate(name);
};

export const fileLoaderDrawio: FileLoader = async (
  content,
  url,
  documentFactory,
  diagramFactory
) => {
  return await drawioReader(content, url, documentFactory, diagramFactory);
};
