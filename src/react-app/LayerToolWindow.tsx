import { useEffect } from 'react';
import { ToolWindowAccordion } from './ToolWindowAccordion.tsx';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { $c } from '../utils/classname.ts';

export const LayerToolWindow = (props: Props) => {
  const redraw = useRedraw();

  useEffect(() => {
    const onChange = () => {
      redraw();
    };
    props.diagram.selectionState.on('change', onChange);
    props.diagram.on('*', onChange);
    return () => {
      props.diagram.selectionState.off('change', onChange);
      props.diagram.off('*', onChange);
    };
  }, [props.diagram, redraw]);

  return (
    <ToolWindowAccordion title={'Layers'}>
      {props.diagram.elements.map(e => (
        <div
          key={e.id}
          className={$c('cmp-tool-window-layer__element', {
            selected: props.diagram.selectionState.elements.includes(e)
          })}
        >
          {e.type} {e.id}
        </div>
      ))}
    </ToolWindowAccordion>
  );
};

type Props = {
  diagram: EditableDiagram;
};
