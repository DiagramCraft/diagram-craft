import { Diagram } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';
import { SnapManager } from './snap/snapManager.ts';
import { MagnetType } from './snap/magnet.ts';
import { EventEmitter } from '../utils/event.ts';
import { DiagramEdge } from '../model-viewer/diagramEdge.ts';
import { DiagramNode } from '../model-viewer/diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../model-viewer/nodeDefinition.ts';

export interface SnapManagerConfigProps {
  threshold: number;
  enabled: boolean;
  magnetTypes: MagnetType[];
}

class SnapManagerConfig
  extends EventEmitter<{
    change: { after: SnapManagerConfigProps };
  }>
  implements SnapManagerConfigProps
{
  magnetTypes: MagnetType[] = [];
  enabled: boolean = true;
  threshold: number = 5;

  constructor(magnetTypes: MagnetType[]) {
    super();

    this.magnetTypes = magnetTypes;
    this.threshold = 5;
  }

  commit(): void {
    this.emit('change', { after: this });
  }
}

export class EditableDiagram extends Diagram {
  selectionState: SelectionState = new SelectionState(this);

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
