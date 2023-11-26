import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import { $c } from '../../utils/classname.ts';

export const LayerList = (props: Props) => (
  <div className={'cmp-layer-list'}>
    {props.diagram.elements.map(e => (
      <div
        key={e.id}
        className={$c('cmp-layer-list__element', {
          selected: props.diagram.selectionState.elements.includes(e)
        })}
      >
        {e.type} {e.id}
      </div>
    ))}
  </div>
);

type Props = { diagram: EditableDiagram };
