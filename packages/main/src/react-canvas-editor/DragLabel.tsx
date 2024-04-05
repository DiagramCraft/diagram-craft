import { DRAG_DROP_MANAGER } from '../react-canvas-viewer/DragDropManager.ts';
import { State } from '../base-ui/drag/dragDropManager.ts';
import { Component, createEffect } from '../base-ui/component.ts';
import * as html from '../base-ui/vdom-html.ts';
import { text } from '../base-ui/vdom.ts';
import { useComponent } from '../react-canvas-viewer/temp/useComponent.temp.ts';
import { deepEquals } from '../utils/object.ts';
import { hasElements } from '../utils/array.ts';

export class DragLabelComponent extends Component {
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

    return html.div({ class: 'cmp-drag-label', style: 'left: 0; top: 0; z-index: 1000;' }, [
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

export const DragLabel = () => {
  const ref = useComponent<Record<string, never>, DragLabelComponent, HTMLDivElement>(
    () => new DragLabelComponent(),
    {}
  );

  return <div ref={ref}></div>;
  /*
  const redraw = useRedraw();
  const drag = useDragDrop();
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State | undefined>(undefined);

  drag.on('dragStateChange', () => {
    setState(drag.current()?.state);
  });
  drag.on('dragEnd', redraw);

  useDomEventListener(
    'mousemove',
    e => {
      ref.current?.style.setProperty('left', e.pageX + 20 + 'px');
      ref.current?.style.setProperty('top', e.pageY + 20 + 'px');
    },
    document
  );

  if (!drag.current() || !drag.current()?.state.label) return undefined;

  const s: State = state!;

  return (
    <div
      ref={ref}
      className={'cmp-drag-label'}
      style={{
        left: 0,
        top: 0,
        zIndex: 1000
      }}
    >
      <div>{s.label}</div>
      {s.props && (
        <div className={'cmp-drag-label__props'}>
          {Object.entries(s.props).map(([key, value]) => (
            <div key={key} className={'cmp-drag-label__prop'}>
              {key}: {value}
            </div>
          ))}
        </div>
      )}
      {s.modifiers && s.modifiers.length > 0 && (
        <div className={'cmp-drag-label__modifiers'}>
          {s.modifiers.map(modifier => (
            <div key={modifier.key} data-state={modifier.isActive ? 'active' : 'inactive'}>
              {modifier.key}: {modifier.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
   */
};
