import { useDragDrop } from '../react-canvas-viewer/DragDropManager.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { useDomEventListener } from '../react-app/hooks/useEventListener.ts';
import { useRef, useState } from 'react';
import { State } from '../base-ui/drag/dragDropManager.ts';

export const DragLabel = () => {
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
};
