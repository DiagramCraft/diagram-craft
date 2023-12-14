import { Diagram } from '../model-viewer/diagram.ts';
import { SelectionState } from './selectionState.ts';
import { SnapManager } from './snap/snapManager.ts';
import { MagnetType } from './snap/magnet.ts';
import { EventEmitter } from '../utils/event.ts';
import { DiagramElement } from '../model-viewer/diagramNode.ts';
import { EdgeDefinitionRegistry, NodeDefinitionRegistry } from '../model-viewer/nodeDefinition.ts';
import { UndoManager } from './undoManager.ts';

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

// TODO: Is it really worth separating editable and not editable diagrams?
//       Maybe it's only the SnapManager that is significant in terms of size etc
export class EditableDiagram extends Diagram {
  readonly selectionState: SelectionState = new SelectionState(this);
  readonly snapManagerConfig = new SnapManagerConfig([
    'grid',
    'node',
    'canvas',
    'distance',
    'size'
  ]);
  readonly undoManager = new UndoManager();

  constructor(
    id: string,
    name: string,
    readonly nodeDefinitions: NodeDefinitionRegistry,
    readonly edgeDefinitions: EdgeDefinitionRegistry,
    elements: DiagramElement[]
  ) {
    super(id, name, nodeDefinitions, edgeDefinitions, elements);
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
