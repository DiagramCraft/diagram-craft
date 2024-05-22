import * as ReactCollapsible from '@radix-ui/react-collapsible';
import { ReactNode, useState } from 'react';
import { TbChevronDown, TbChevronRight } from 'react-icons/tb';

export const Collapsible = (props: Props) => {
  const [open, setOpen] = useState(props.isOpen);
  return (
    <ReactCollapsible.Root className="cmp-collapsible" open={open} onOpenChange={setOpen}>
      <div className={'cmp-collapsible__trigger'}>
        <ReactCollapsible.Trigger asChild>
          <button className="cmp-collapsible__trigger_inner">
            {open ? <TbChevronDown /> : <TbChevronRight />}
            {props.label}
          </button>
        </ReactCollapsible.Trigger>
      </div>

      <ReactCollapsible.Content className={'cmp-collapsible__content'}>
        {props.children}
      </ReactCollapsible.Content>
    </ReactCollapsible.Root>
  );
};

type Props = {
  label: string;
  children: ReactNode;
  isOpen?: boolean;
};
