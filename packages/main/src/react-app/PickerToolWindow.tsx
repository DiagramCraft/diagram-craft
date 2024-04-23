import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger';
import { AccordionContent } from './AccordionContext';
import { ObjectPicker } from './ObjectPicker';
import { useDiagram } from './context/DiagramContext';
import { useState } from 'react';

export const PickerToolWindow = () => {
  const diagram = useDiagram();
  const groups = diagram.document.nodeDefinitions.getGroups();
  const [open, setOpen] = useState(['basic-shapes']);

  return (
    <Accordion.Root className="cmp-accordion" type="multiple" value={open} onValueChange={setOpen}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker size={35} />
        </AccordionContent>
      </Accordion.Item>

      {groups.map((group, idx) => (
        <Accordion.Item key={idx} className="cmp-accordion__item" value={group}>
          <AccordionTrigger>{group}</AccordionTrigger>
          <AccordionContent>
            <ObjectPicker size={35} group={group} />
          </AccordionContent>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
};
