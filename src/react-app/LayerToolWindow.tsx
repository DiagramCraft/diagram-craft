import { useEffect } from 'react';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { LayerList } from './components/LayerList.tsx';
import { useDiagram } from './context/DiagramContext.tsx';

export const LayerToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEffect(() => {
    const onChange = () => {
      redraw();
    };
    diagram.selectionState.on('change', onChange);
    diagram.on('canvaschanged', onChange);
    diagram.on('nodechanged', onChange);
    diagram.on('noderemoved', onChange);
    diagram.on('nodeadded', onChange);
    diagram.on('edgechanged', onChange);
    diagram.on('edgeadded', onChange);
    diagram.on('edgeremoved', onChange);
    return () => {
      diagram.selectionState.off('change', onChange);
      diagram.off('canvaschanged', onChange);
      diagram.off('nodechanged', onChange);
      diagram.off('noderemoved', onChange);
      diagram.off('nodeadded', onChange);
      diagram.off('edgechanged', onChange);
      diagram.off('edgeadded', onChange);
      diagram.off('edgeremoved', onChange);
    };
  }, [diagram, redraw]);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['layers']}>
      <Accordion.Item className="cmp-accordion__item" value="layers">
        <AccordionTrigger>Layers</AccordionTrigger>
        <AccordionContent>
          <LayerList />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
