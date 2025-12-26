import { getParser } from './drawioShapeParserRegistry';
import { getShapeBundle } from './drawioShapeBundleRegistry';
import { Point } from '@diagram-craft/geometry/point';
import { xNum } from '@diagram-craft/utils/xml';

export const angleFromDirection = (s: string) => {
  if (s === 'north') return -Math.PI / 2;
  if (s === 'south') return Math.PI / 2;
  if (s === 'east') return 0;
  if (s === 'west') return Math.PI;
  return 0;
};

export const isStencilString = (shape: string | undefined) => {
  return shape?.startsWith('stencil(');
};

export const parseStencilString = (shape: string | undefined) => {
  if (!shape) return undefined;

  if (!isStencilString(shape)) {
    if (getParser(shape) || getShapeBundle(shape)) {
      return undefined;
    } else {
      console.warn(`Unsupported shape ${shape}`);
      return undefined;
    }
  }

  return /^stencil\(([^)]+)\)$/.exec(shape)![1];
};

export const MxPoint = {
  pointFrom: (offset: Element) => Point.of(xNum(offset, 'x', 0), xNum(offset, 'y', 0))
};

export const MxGeometry = {
  boundsFrom: (geometry: Element) => {
    return {
      x: xNum(geometry, 'x', 0),
      y: xNum(geometry, 'y', 0),
      w: xNum(geometry, 'width', 100),
      h: xNum(geometry, 'height', 100),
      r: 0
    };
  }
};

export const isHTML = (value: string | undefined) => value?.startsWith('<');

export const hasValue = (value: string | undefined | null): value is string => {
  if (!value || value.trim() === '') return false;

  if (isHTML(value)) {
    if (value.includes('<img')) return true;
    try {
      const d = new DOMParser().parseFromString(value, 'text/html');
      const text = d.body.textContent;
      return !!text && text.trim() !== '';
    } catch (_e) {
      // Ignore
    }
  }
  return true;
};

export const deflate = async (data: string) => {
  const binaryContents = atob(data);

  const arr = Uint8Array.from(binaryContents, c => c.charCodeAt(0));

  const inputStream = new ReadableStream({
    start(controller) {
      controller.enqueue(arr);
      controller.close();
    }
  });

  const ds = new DecompressionStream('deflate-raw');
  const decompressed = await new Response(inputStream.pipeThrough(ds)).arrayBuffer();

  const decoded = new TextDecoder().decode(decompressed);

  return decodeURIComponent(decoded);
};
