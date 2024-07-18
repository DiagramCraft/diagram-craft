import { useState } from 'react';
import { Select } from '@diagram-craft/app-components/Select';
import { DiagramRef } from '../App';
import { urlToName } from '@diagram-craft/utils/url';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';

export const DocumentSelector = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState(props.selectedUrl);

  const loadDocument = async (idx: number) => {
    const ref = props.diagrams[idx];
    props.onChange(ref.url);
  };

  let diagrams: Array<DiagramRef & { isTemp?: boolean }> = [...props.diagrams];

  if (!diagrams.find(d => d.url === selectedDiagram)) {
    diagrams.push({ url: selectedDiagram, name: urlToName(selectedDiagram), isTemp: true });
  }

  diagrams = diagrams.filter(d => d.url === selectedDiagram || !d.isTemp);

  return (
    <Select.Root
      onValueChange={v => {
        setSelectedDiagram(props.diagrams[Number(v)].url);
        loadDocument(Number(v));
      }}
      value={diagrams.findIndex(d => d.url === selectedDiagram).toString()}
    >
      {/* TODO: Use url suffix here */}
      {diagrams.map((d, idx) => (
        <Select.Item key={idx.toString()} value={idx.toString()}>
          {d.name ?? urlToName(d.url)}
        </Select.Item>
      ))}
    </Select.Root>
  );
};

type Props = {
  diagrams: Array<DiagramRef>;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory<Diagram>;
  selectedUrl: string;
  onChange: (url: string) => void;
};
