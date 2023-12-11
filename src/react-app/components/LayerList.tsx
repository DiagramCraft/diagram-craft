import { $c } from '../../utils/classname.ts';
import { useDiagram } from '../context/DiagramContext.tsx';

export const LayerList = () => {
  const diagram = useDiagram();
  return (
    <div className={'cmp-layer-list'}>
      {diagram.elements.map(e => (
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
  );
};
