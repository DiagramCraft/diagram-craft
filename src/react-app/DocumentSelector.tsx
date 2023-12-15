import React, { useState } from 'react';
import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';
import { DiagramDocument } from '../model/diagramDocument.ts';

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>((props, forwardedRef) => {
  return (
    <Select.Item className={'cmp-select-content__item'} ref={forwardedRef} value={props.value}>
      <Select.ItemText>{props.children}</Select.ItemText>
      <Select.ItemIndicator className="cmp-select-content__item-indicator">
        <TbCheck />
      </Select.ItemIndicator>
    </Select.Item>
  );
});

type SelectItemProps = {
  value: string;
  children: React.ReactNode;
};

export const DocumentSelector = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState(props.defaultValue);

  return (
    <Select.Root
      onValueChange={v => {
        setSelectedDiagram(Number(v));
        props.onChange(props.diagrams[Number(v)].document);
      }}
      value={selectedDiagram.toString()}
    >
      <Select.Trigger className="cmp-select-trigger">
        <Select.Value placeholder={props.diagrams[selectedDiagram].name} />
        <Select.Icon className="cmp-select-trigger__icon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="cmp-select-content">
          <Select.Viewport className="cmp-select-content__viewpoint">
            <Select.Group>
              {props.diagrams.map((d, idx) => (
                <SelectItem key={idx} value={idx.toString()}>
                  {d.name}
                </SelectItem>
              ))}
            </Select.Group>
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
};

type Props = {
  diagrams: {
    name: string;
    document: DiagramDocument;
  }[];
  defaultValue: number;
  onChange: (document: DiagramDocument) => void;
};
