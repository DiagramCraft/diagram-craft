import { useEffect } from 'react';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import { $c } from '../utils/classname.ts';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';

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
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['layers']}>
      <Accordion.Item className="cmp-accordion__item" value="layers">
        <AccordionTrigger>Layers</AccordionTrigger>
        <AccordionContent>
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
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};

type Props = {
  diagram: EditableDiagram;
};
