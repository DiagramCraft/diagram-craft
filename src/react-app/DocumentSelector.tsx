import React, { useState } from 'react';
import { EditableDiagram } from '../model-editor/editable-diagram.ts';
import * as Select from '@radix-ui/react-select';
import { TbCheck, TbChevronDown } from 'react-icons/tb';

const SelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>((props, forwardedRef) => {
  return (
    <Select.Item className={'SelectItem'} ref={forwardedRef} value={props.value}>
      <Select.ItemText>{props.children}</Select.ItemText>
      <Select.ItemIndicator className="SelectItemIndicator">
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
        props.onChange(props.diagrams[Number(v)].diagram);
      }}
      value={selectedDiagram.toString()}
    >
      <Select.Trigger className="SelectTrigger">
        <Select.Value placeholder={props.diagrams[selectedDiagram].name} />
        <Select.Icon className="SelectIcon">
          <TbChevronDown />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="SelectContent">
          <Select.Viewport className="SelectViewport">
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
    diagram: EditableDiagram;
  }[];
  defaultValue: number;
  onChange: (diagram: EditableDiagram) => void;
};
