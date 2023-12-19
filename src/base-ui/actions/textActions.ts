import { ActionEvents, ActionMapFactory, State, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    TEXT_BOLD: TextAction;
    TEXT_ITALIC: TextAction;
    TEXT_UNDERLINE: TextDecorationAction;
  }
}

export const textActions: ActionMapFactory = (state: State) => ({
  TEXT_BOLD: new TextAction(state.diagram, 'bold'),
  TEXT_ITALIC: new TextAction(state.diagram, 'italic'),
  TEXT_UNDERLINE: new TextDecorationAction(state.diagram, 'underline')
});

// TODO: Both of these actions must listen for node changes and update state
export class TextAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = false;
  state = false;

  constructor(
    protected readonly diagram: Diagram,
    private readonly prop: 'bold' | 'italic'
  ) {
    super();
    const callback = () => {
      if (diagram.selectionState.isNodesOnly() && diagram.selectionState.nodes.length === 1) {
        this.enabled = diagram.selectionState.nodes[0].nodeType === 'text';
      } else {
        this.enabled = false;
      }
      this.emit('actionchanged', { action: this });
    };
    callback();
    diagram.selectionState.on('add', callback);
    diagram.selectionState.on('remove', callback);
  }

  execute(): void {
    // TODO: Make these undoable
    //       maybe add a property setter helper much like useNodeProperty
    const node = this.diagram.selectionState.nodes[0];

    node.props.text ??= {};
    node.props.text[this.prop] ??= false;
    node.props.text[this.prop] = !node.props.text[this.prop];

    this.state = !!node.props.text[this.prop];
    this.emit('actionchanged', { action: this });

    this.diagram.updateElement(node);
  }
}

export class TextDecorationAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = false;
  state = false;

  constructor(
    protected readonly diagram: Diagram,
    private readonly prop: 'underline' | 'line-through' | 'overline'
  ) {
    super();
    const callback = () => {
      if (diagram.selectionState.isNodesOnly() && diagram.selectionState.nodes.length === 1) {
        this.enabled = diagram.selectionState.nodes[0].nodeType === 'text';
      } else {
        this.enabled = false;
      }
      this.emit('actionchanged', { action: this });
    };
    callback();
    diagram.selectionState.on('add', callback);
    diagram.selectionState.on('remove', callback);
  }

  execute(): void {
    // TODO: Make these undoable
    //       maybe add a property setter helper much like useNodeProperty
    const node = this.diagram.selectionState.nodes[0];

    node.props.text ??= {};
    if (node.props.text.textDecoration === this.prop) {
      node.props.text.textDecoration = 'none';
    } else {
      node.props.text.textDecoration = this.prop;
    }

    this.state = node.props.text.textDecoration === this.prop;
    this.emit('actionchanged', { action: this });

    this.diagram.updateElement(node);
  }
}
