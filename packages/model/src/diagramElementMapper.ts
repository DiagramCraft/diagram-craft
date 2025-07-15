import { Layer } from './diagramLayer';
import type { DiagramElement, DiagramElementCRDT } from './diagramElement';
import { CRDTMap } from './collaboration/crdt';
import type { CRDTMapper } from './collaboration/datatypes/mapped/mappedCrdt';
import { assert } from '@diagram-craft/utils/assert';

/* Note: the use of FACTORIES and registerElementFactory seems somewhat convoluted,
 * but it's there to resolve circular dependencies */
type DiagramElementFactory = (
  id: string,
  layer: Layer,
  crdt: CRDTMap<DiagramElementCRDT>
) => DiagramElement;

const FACTORIES: Record<string, DiagramElementFactory> = {};

export const registerElementFactory = (type: string, factory: DiagramElementFactory) => {
  FACTORIES[type] = factory;
};

export const makeElementMapper = (
  layer: Layer
): CRDTMapper<DiagramElement, DiagramElementCRDT> => ({
  fromCRDT: (e: CRDTMap<DiagramElementCRDT>) => {
    const type = e.get('type')!;
    const id = e.get('id')!;

    const existing = layer.diagram.lookup(id);
    if (existing) {
      existing.crdt.set(e);
      return existing;
    }

    if (!FACTORIES[type]) assert.fail(`Unknown element type: ${type}`);
    return FACTORIES[type](id, layer, e);
  },

  toCRDT: (e: DiagramElement) => e.crdt.get()
});
