import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger';
import { AccordionContent } from './AccordionContext';
import { ObjectPicker } from './ObjectPicker';

export const PickerToolWindow = () => {
  return (
    <Accordion.Root className="cmp-accordion" type="multiple" defaultValue={['basic-shapes']}>
      <Accordion.Item className="cmp-accordion__item" value="basic-shapes">
        <AccordionTrigger>Basic shapes</AccordionTrigger>
        <AccordionContent>
          <ObjectPicker size={35} />
        </AccordionContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
