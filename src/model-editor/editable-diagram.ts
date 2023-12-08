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
  #threshold: number = 5;
  #enabled: boolean = true;

  constructor(magnetTypes: MagnetType[]) {
    super();
    this.#magnetTypes = magnetTypes;
    this.#enabled = true;
    this.#threshold = 5;
  }

  set magnetTypes(types: MagnetType[]) {
    this.#magnetTypes = types;
    this.emit('change', { config: this });
  }

  get magnetTypes(): Readonly<MagnetType[]> {
    return this.#magnetTypes;
  }

  set threshold(threshold: number) {
    this.#threshold = threshold;
    this.emit('change', { config: this });
  }

  get threshold(): number {
    return this.#threshold;
  }

  set enabled(enabled: boolean) {
    this.#enabled = enabled;
    this.emit('change', { config: this });
  }

  get enabled(): boolean {
    return this.#enabled;
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
      this.snapManagerConfig.magnetTypes,
      this.snapManagerConfig.threshold,
      this.snapManagerConfig.enabled
    );
  }
}
