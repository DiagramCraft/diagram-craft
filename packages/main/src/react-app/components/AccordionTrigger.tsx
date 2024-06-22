import React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { TbChevronDown } from 'react-icons/tb';

export const AccordionTrigger = React.forwardRef<HTMLButtonElement, { children: React.ReactNode }>(
  (props, forwardedRef) => (
    <Accordion.Header className="cmp-accordion__header">
      <Accordion.Trigger className={'cmp-accordion__trigger'} ref={forwardedRef}>
        {props.children}
        <div className={'cmp-accordion__chevron'}>
          <TbChevronDown />
        </div>
      </Accordion.Trigger>
    </Accordion.Header>
  )
);
