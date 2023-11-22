import { Diagram, DiagramEdge, DiagramNode } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';
import { SnapManager } from './snap/snapManager.ts';
import { MagnetType } from './snap/magnet.ts';
import { EventEmitter } from '../utils/event.ts';

type SnapManagerConfigEvents = {
  change: { config: SnapManagerConfig };
};

class SnapManagerConfig extends EventEmitter<SnapManagerConfigEvents> {
  #magnetTypes: MagnetType[] = [];

  constructor(magnetTypes: MagnetType[]) {
    super();
    this.#magnetTypes = magnetTypes;
  }

  set magnetTypes(types: MagnetType[]) {
    this.#magnetTypes = types;
    this.emit('change', { config: this });
  }

  get magnetTypes(): Readonly<MagnetType[]> {
    return this.#magnetTypes;
  }
}

export class EditableDiagram extends Diagram {
  selectionState: SelectionState = new SelectionState();

  snapManagerConfig = new SnapManagerConfig(['grid', 'node', 'canvas', 'distance', 'size']);

  constructor(elements: (DiagramEdge | DiagramNode)[]) {
    super(elements);
  }

  createSnapManager() {
    return new SnapManager(
      this,
      this.selectionState.elements.map(e => e.id),
      this.snapManagerConfig.magnetTypes
    );
  }
}
