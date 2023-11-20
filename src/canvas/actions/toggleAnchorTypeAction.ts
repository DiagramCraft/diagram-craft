import { ActionEvents, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { AnchorType } from '../../model-editor/snap/anchor.ts';
import { EditableDiagram } from '../../model-editor/editable-diagram.ts';

declare global {
  interface ActionMap {
    TOGGLE_ANCHOR_TYPE_SIZE: ToggleAnchorTypeAction;
    TOGGLE_ANCHOR_TYPE_GRID: ToggleAnchorTypeAction;
    TOGGLE_ANCHOR_TYPE_CANVAS: ToggleAnchorTypeAction;
    TOGGLE_ANCHOR_TYPE_NODE: ToggleAnchorTypeAction;
    TOGGLE_ANCHOR_TYPE_DISTANCE: ToggleAnchorTypeAction;
  }
}

export class ToggleAnchorTypeAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = false;
  state: boolean;

  constructor(
    private readonly diagram: EditableDiagram,
    private readonly anchorType: AnchorType
  ) {
    super();
    this.state = diagram.snapManagerConfig.anchorTypes.includes(anchorType);

    this.diagram.snapManagerConfig.on('change', () => {
      this.state = diagram.snapManagerConfig.anchorTypes.includes(anchorType);
      this.emit('actionchanged', { action: this });
    });
  }

  execute(): void {
    if (this.state) {
      this.diagram.snapManagerConfig.anchorTypes =
        this.diagram.snapManagerConfig.anchorTypes.filter(type => type !== this.anchorType);
    } else {
      this.diagram.snapManagerConfig.anchorTypes = [
        ...this.diagram.snapManagerConfig.anchorTypes,
        this.anchorType
      ];
    }
  }
}
