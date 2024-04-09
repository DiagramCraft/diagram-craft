import { DRAG_DROP_MANAGER } from './DragDropManager.ts';
import { Component, createEffect } from './component/component.ts';
import * as html from './component/vdom-html.ts';
import { text } from './component/vdom.ts';
import { deepEquals } from '@diagram-craft/utils';
import { CanvasState } from './EditableCanvas.ts';
import { hasElements } from '@diagram-craft/utils';
import { State } from './drag/dragDropManager.ts';

export class DragLabelComponent extends Component<CanvasState> {
  private state: State | undefined = undefined;

  setState(state: State | undefined) {
    // TODO: Maybe move this into the dragStateChange event emission - this way, it's only done once
    if (deepEquals(this.state, state)) return;

    this.state = state;
    this.redraw();
  }

  render() {
    createEffect(() => {
      const cb = () => this.setState(DRAG_DROP_MANAGER.current()?.state);
      DRAG_DROP_MANAGER.on('dragStateChange', cb);
      return () => DRAG_DROP_MANAGER.off('dragStateChange', cb);
    }, []);

    createEffect(() => {
      const cb = () => this.setState(undefined);
      DRAG_DROP_MANAGER.on('dragEnd', cb);
      return () => DRAG_DROP_MANAGER.off('dragEnd', cb);
    }, []);

    createEffect(() => {
      const cb = (e: MouseEvent) => {
        (this.element!.el! as HTMLDivElement).style.setProperty('left', e.pageX + 20 + 'px');
        (this.element!.el! as HTMLDivElement).style.setProperty('top', e.pageY + 20 + 'px');
      };
      document.addEventListener('mousemove', cb);
      return () => document.removeEventListener('mousemove', cb);
    }, []);

    if (!this.state) return html.div({ style: 'display: none' });

    const s = this.state!;

    return html.div({ class: 'cmp-drag-label', style: 'z-index: 1000;' }, [
      html.div({}, [text(s.label ?? '')]),
      s.props &&
        html.div(
          { class: 'cmp-drag-label__props' },
          Object.entries(s.props).map(([key, value]) =>
            html.div({ class: 'cmp-drag-label__prop' }, [text(`${key}: ${value}`)])
          )
        ),
      hasElements(s.modifiers) &&
        html.div(
          { class: 'cmp-drag-label__modifiers' },
          s.modifiers.map(modifier =>
            html.div({ 'data-state': modifier.isActive ? 'active' : 'inactive' }, [
              text(`${modifier.key}: ${modifier.label}`)
            ])
          )
        )
    ]);
  }
}
