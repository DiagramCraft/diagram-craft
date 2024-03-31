import { useEffect } from 'react';
import { useRedraw } from '../react-canvas-viewer/useRedraw.tsx';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { LayerList } from './LayerList.tsx';
import { useDiagram } from './context/DiagramContext.ts';

export const LayerToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEffect(() => {
    const onChange = () => {
      redraw();
    };
    diagram.on('change', onChange);
    diagram.on('elementRemove', onChange);
    diagram.on('elementAdd', onChange);
    return () => {
      diagram.off('change', onChange);
      diagram.off('elementRemove', onChange);
      diagram.off('elementAdd', onChange);
    };
  }, [diagram, redraw]);

  return (
    <Accordion.Root className="cmp-accordion" type="single" defaultValue={'layers'}>
      <Accordion.Item className="cmp-accordion__item cmp-accordion__item--fill" value="layers">
        <AccordionTrigger>Layers</AccordionTrigger>
        <AccordionContent>
          <LayerList />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
