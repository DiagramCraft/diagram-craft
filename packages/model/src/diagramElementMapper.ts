import { Layer } from './diagramLayer';
import type { DiagramElement, DiagramElementCRDT } from './diagramElement';
import { CRDTMap } from './collaboration/crdt';
import type { CRDTMapper } from './collaboration/datatypes/mapped/mappedCrdt';

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
    return FACTORIES[type](e.get('id')!, layer, e);
  },

  toCRDT: (e: DiagramElement) => e.crdt.get()
});
