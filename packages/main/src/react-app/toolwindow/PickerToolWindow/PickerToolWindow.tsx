import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from '../../components/AccordionTrigger';
import { AccordionContent } from '../../components/AccordionContent';
import { ObjectPicker } from './ObjectPicker';
import { useDiagram } from '../../context/DiagramContext';
import { useState } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';

const SIZE = 35;

export const PickerToolWindow = () => {
  const diagram = useDiagram();
  const stencilRegistry = diagram.document.nodeDefinitions.stencilRegistry;
  const [open, setOpen] = useState(['basic-shapes', 'arrow', 'uml']);
  const redraw = useRedraw();

  useEventListener(stencilRegistry, 'change', redraw);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" value={open} onValueChange={setOpen}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker size={SIZE} package={stencilRegistry.get('default')!} />
        </AccordionContent>
      </Accordion.Item>

      {stencilRegistry
        .getActiveStencils()
        .toSorted((a, b) => a.name.localeCompare(b.name))
        .filter(s => s.id !== 'default')
        .map((group, idx) => (
          <Accordion.Item key={idx} className="cmp-accordion__item" value={group.id}>
            <AccordionTrigger>{group.name}</AccordionTrigger>
            <AccordionContent>
              <ObjectPicker size={SIZE} package={group} />
            </AccordionContent>
          </Accordion.Item>
        ))}
    </Accordion.Root>
  );
};
