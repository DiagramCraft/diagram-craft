import { ActionEvents, ToggleAction } from '../keyMap.ts';
import { EventEmitter } from '../../utils/event.ts';
import { Diagram } from '../../model/diagram.ts';

declare global {
  interface ActionMap {
    TEXT_BOLD: TextAction;
    TEXT_ITALIC: TextAction;
    TEXT_UNDERLINE: TextAction;
  }
}

export class TextAction extends EventEmitter<ActionEvents> implements ToggleAction {
  enabled = false;
  state = false;

  constructor(
    protected readonly diagram: Diagram,
    private readonly prop: 'bold' | 'italic' | 'underline'
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
    // @ts-ignore
    node.props.text[this.prop] ??= false;
    // @ts-ignore
    node.props.text[this.prop] = !node.props.text[this.prop];

    // @ts-ignore
    this.state = node.props.text[this.prop];
    this.emit('actionchanged', { action: this });

    this.diagram.updateElement(node);
  }
}
