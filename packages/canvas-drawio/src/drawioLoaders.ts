import { FileLoader } from '@diagram-craft/canvas-app/loaders';
import { drawioReader } from './drawioReader';
import {
  NodeDefinitionRegistry,
  type StencilLoader
} from '@diagram-craft/model/elementDefinitionRegistry';
import { loadDrawioStencils } from './drawioStencilLoader';
import { toRegularStencil } from './drawioStencilUtils';

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {
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

  if (drawioStencils.length === 0) {
    console.warn(`No stencils found for ${name}`);
    return;
  }

  const stencilRegistry = nodeDefinitions.stencilRegistry;
  stencilRegistry.register({
    id: name,
    name: name,
    stencils: drawioStencils.map(toRegularStencil),
    type: 'drawioXml'
  });
  stencilRegistry.activate(name);
};

export const fileLoaderDrawio: FileLoader = async (content, doc) =>
  await drawioReader(content, doc);
