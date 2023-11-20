import { Diagram, DiagramEdge, DiagramNode } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';
import { SnapManager } from './snap/snapManager.ts';
import { AnchorType } from './snap/anchor.ts';
import { EventEmitter } from '../utils/event.ts';

type SnapManagerConfigEvents = {
  change: { config: SnapManagerConfig };
};

class SnapManagerConfig extends EventEmitter<SnapManagerConfigEvents> {
  #anchorTypes: AnchorType[] = [];

  constructor(anchorTypes: AnchorType[]) {
    super();
    this.#anchorTypes = anchorTypes;
  }

  set anchorTypes(types: AnchorType[]) {
    this.#anchorTypes = types;
    this.emit('change', { config: this });
  }

  get anchorTypes(): Readonly<AnchorType[]> {
    return this.#anchorTypes;
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
      this.snapManagerConfig.anchorTypes
    );
  }
}
