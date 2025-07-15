import type { RegularLayer } from './diagramLayerRegular';
import type { Layer } from './diagramLayer';

export function assertRegularLayer(l: Layer): asserts l is RegularLayer {
  if (l.type !== 'regular') {
    throw new Error('Layer is not a regular layer');
  }
}

export function isRegularLayer(l: Layer): l is RegularLayer {
  return l.type === 'regular';
}

export function isResolvableToRegularLayer(l: Layer): l is Layer<RegularLayer> {
  if (l.resolve()?.type !== 'regular') return false;
  return true;
}
