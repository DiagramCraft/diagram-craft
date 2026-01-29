import { FileLoader } from '@diagram-craft/canvas-app/loaders';
import { drawioReader } from './drawioReader';
import { type StencilLoader } from '@diagram-craft/model/elementDefinitionRegistry';
import { loadDrawioStencils } from './drawioStencilLoader';
import { toRegularStencil } from './drawioStencilUtils';

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {
      drawioXml: {
        name: string;
        url: string;
        foreground: string;
        background: string;
      };
    }
  }
}

export const stencilLoaderDrawioXml: StencilLoader<'drawioXml'> = async (stencilRegistry, opts) => {
  const { name, url, foreground, background } = opts;
  const drawioStencils = await loadDrawioStencils(url, name, foreground, background);

  if (drawioStencils.length === 0) {
    console.warn(`No stencils found for ${name}`);
    return;
  }

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
