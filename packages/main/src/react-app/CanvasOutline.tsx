import { useRedraw } from './hooks/useRedraw';
import { useDiagram } from '../application';
import { useEventListener } from './hooks/useEventListener';

export const CanvasOutline = () => {
  const $d = useDiagram();
  const redraw = useRedraw();

  useEventListener($d, 'change', () => queueMicrotask(() => redraw()));

  if ($d.layers.active.type === 'regular' && !$d.layers.active.isLocked()) {
    return null;
  }

  return (
    <div
      className={'cmp-canvas-marker'}
      data-ruler-enabled={$d.props.ruler?.enabled !== false}
    ></div>
  );
};
