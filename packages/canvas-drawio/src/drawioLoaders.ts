import { FileLoader } from '@diagram-craft/canvas-app/loaders';
import { drawioReader } from './drawioReader';
import { type StencilLoader } from '@diagram-craft/model/stencilRegistry';
import { loadDrawioStencils } from './drawioStencilLoader';
import { toRegularStencil } from './drawioStencilUtils';

declare global {
  namespace DiagramCraft {
    interface StencilLoaderOptsExtensions {
      drawioXml: {
        url: string;
        foreground: string;
        background: string;
      };
    }
  }
}

export const stencilLoaderDrawioXml: StencilLoader<'drawioXml'> = async (_registry, opts) => {
  const { url, foreground, background } = opts;
  const drawioStencils = await loadDrawioStencils(url, foreground, background);
  return { stencils: drawioStencils.map(toRegularStencil), type: 'drawioXml' };
};

export const fileLoaderDrawio: FileLoader = async (content, doc) =>
  await drawioReader(content, doc);
