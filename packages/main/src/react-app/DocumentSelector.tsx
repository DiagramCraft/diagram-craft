import { useState } from 'react';
import { Select } from './components/Select';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramRef } from '../App';
import { loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { urlToName } from '@diagram-craft/utils/url';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';

export const DocumentSelector = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState(props.selectedUrl);

  const loadDocument = async (idx: number) => {
    const ref = props.diagrams[idx];

    props.onChange(ref.url, loadFileFromUrl(ref.url, props.documentFactory, props.diagramFactory));
  };

  let diagrams: Array<DiagramRef & { isTemp?: boolean }> = [...props.diagrams];

  if (!diagrams.find(d => d.url === selectedDiagram)) {
    diagrams.push({ url: selectedDiagram, name: urlToName(selectedDiagram), isTemp: true });
  }

  diagrams = diagrams.filter(d => d.url === selectedDiagram || !d.isTemp);

  return (
    <Select
      onValueChange={v => {
        setSelectedDiagram(props.diagrams[Number(v)].url);
        loadDocument(Number(v));
      }}
      value={diagrams.findIndex(d => d.url === selectedDiagram).toString()}
      values={diagrams.map((d, idx) => ({
        value: idx.toString(),
        label: d.name ?? urlToName(d.url) /* TODO: Use url suffix here */
      }))}
    />
  );
};

type Props = {
  diagrams: Array<DiagramRef>;
  documentFactory: DocumentFactory;
  diagramFactory: DiagramFactory<Diagram>;
  selectedUrl: string;
  onChange: (url: string, document: Promise<DiagramDocument>) => void;
};
