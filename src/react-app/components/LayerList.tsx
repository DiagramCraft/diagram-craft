import { $c } from '../../utils/classname.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

function reversed<T>(l: T[]): T[] {
  return [...l].reverse();
}

export const LayerList = () => {
  const diagram = useDiagram();

  const layers = reversed(diagram.layers.all);

  return (
    <div className={'cmp-layer-list'}>
      {layers.map(l => (
        <div key={l.id} className={'cmp-layer-list__element'}>
          {l.name}

          {reversed(l.elements).map(e => (
            <div
              key={e.id}
              className={$c('cmp-layer-list__element', {
                selected: diagram.selectionState.elements.includes(e)
              })}
            >
              {e.type} {e.id}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
