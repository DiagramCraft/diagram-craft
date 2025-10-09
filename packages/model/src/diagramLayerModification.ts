import { Layer, type LayerCRDT } from './diagramLayer';
import { CRDTMap } from './collaboration/crdt';
import { type Diagram } from './diagram';
import type { DiagramElement } from './diagramElement';

type Modification = {
  id: string;
  type: 'add' | 'remove' | 'modify';
  element: DiagramElement;
};

export class ModificationLayer extends Layer<ModificationLayer> {
  constructor(
    id: string,
    name: string,
    diagram: Diagram,
    _modifications: Readonly<Array<Modification>>,
    crdt?: CRDTMap<LayerCRDT>
  ) {
    super(id, name, diagram, 'modification', crdt);
  }

  resolve() {
    return this;
  }
}
