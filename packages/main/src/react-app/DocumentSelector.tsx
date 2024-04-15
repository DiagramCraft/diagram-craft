import { useState } from 'react';
import { Select } from './components/Select';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';

export const DocumentSelector = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState(props.defaultValue);

  return (
    <Select
      onValueChange={v => {
        setSelectedDiagram(Number(v));
        props.onChange(props.diagrams[Number(v)].document);
      }}
      value={selectedDiagram.toString()}
      values={props.diagrams.map((d, idx) => ({ value: idx.toString(), label: d.name }))}
    />
  );
};

type Props = {
  diagrams: {
    name: string;
    document: Promise<DiagramDocument>;
  }[];
  defaultValue: number;
  onChange: (document: Promise<DiagramDocument>) => void;
};
