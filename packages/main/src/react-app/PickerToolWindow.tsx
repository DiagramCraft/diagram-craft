import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger';
import { AccordionContent } from './AccordionContext';
import { ObjectPicker } from './ObjectPicker';
import { useDiagram } from './context/DiagramContext';
import { useState } from 'react';

export const PickerToolWindow = () => {
  const diagram = useDiagram();
  const groups = diagram.document.nodeDefinitions.stencilRegistry.getActiveStencils();
  const [open, setOpen] = useState(['basic-shapes', 'arrow']);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" value={open} onValueChange={setOpen}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker
            size={35}
            package={diagram.document.nodeDefinitions.stencilRegistry.get('default')!}
          />
        </AccordionContent>
      </Accordion.Item>

      {groups
        .filter(s => s.id !== 'default')
        .map((group, idx) => (
          <Accordion.Item key={idx} className="cmp-accordion__item" value={group.id}>
            <AccordionTrigger>{group.name}</AccordionTrigger>
            <AccordionContent>
              <ObjectPicker size={35} package={group} />
            </AccordionContent>
          </Accordion.Item>
        ))}
    </Accordion.Root>
  );
};
