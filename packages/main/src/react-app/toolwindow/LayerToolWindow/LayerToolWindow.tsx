import { useEffect } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../../components/AccordionTrigger';
import { AccordionContent } from '../../components/AccordionContent';
import { LayerList } from './LayerList';
import { useDiagram } from '../../context/DiagramContext';

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
    <Accordion.Root className="cmp-accordion" disabled={true} type="single" defaultValue={'layers'}>
      <Accordion.Item className="cmp-accordion__item cmp-accordion__item--fill" value="layers">
        <AccordionTrigger>Layers</AccordionTrigger>
        <AccordionContent>
          <LayerList />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
