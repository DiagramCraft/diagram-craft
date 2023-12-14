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
    diagram.on('change', onChange);
    diagram.on('elementRemove', onChange);
    diagram.on('elementChange', onChange);
    diagram.on('elementAdd', onChange);
    return () => {
      diagram.selectionState.off('change', onChange);
      diagram.off('change', onChange);
      diagram.off('elementRemove', onChange);
      diagram.off('elementChange', onChange);
      diagram.off('elementAdd', onChange);
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
