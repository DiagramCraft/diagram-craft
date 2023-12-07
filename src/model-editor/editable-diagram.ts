import { Diagram } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';
import { SnapManager } from './snap/snapManager.ts';
import { MagnetType } from './snap/magnet.ts';
import { EventEmitter } from '../utils/event.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';
import { DiagramNode } from '../model-viewer/diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../model-viewer/nodeDefinition.ts';

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

  diagrams: EditableDiagram[] = [];

  constructor(
    id: string,
    name: string,
    elements: (DiagramEdge | DiagramNode)[],
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry
  ) {
    super(id, name, elements, nodeDefinitions, edgeDefinitions);
  }

  createSnapManager() {
    return new SnapManager(
      this,
      this.selectionState.elements.map(e => e.id),
      this.snapManagerConfig.magnetTypes
    );
  }
}
