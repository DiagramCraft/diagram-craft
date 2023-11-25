import React from 'react';
import * as Accordion from '@radix-ui/react-accordion';

export const AccordionContent = React.forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  (props, forwardedRef) => (
    <Accordion.Content className="cmp-accordion__content" ref={forwardedRef}>
      <div className={'cmp-accordion__content_text'}>{props.children}</div>
    </Accordion.Content>
  )
);
