import * as Accordion from '@radix-ui/react-accordion';
import { AccordionTrigger } from './AccordionTrigger.tsx';
import { AccordionContent } from './AccordionContext.tsx';
import { ObjectPicker } from './ObjectPicker.tsx';

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
