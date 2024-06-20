import { useState } from 'react';
import { Select } from './components/Select';
import { DiagramDocument } from '@diagram-craft/model/diagramDocument';
import { DiagramRef } from '../App';
import { getFileLoaderForUrl, loadFileFromUrl } from '@diagram-craft/canvas-app/loaders';
import { assert } from '@diagram-craft/utils/assert';
import { urlToName } from '@diagram-craft/utils/url';
import { DiagramFactory, DocumentFactory } from '@diagram-craft/model/serialization/deserialize';
import { Diagram } from '@diagram-craft/model/diagram';

export const DocumentSelector = (props: Props) => {
  const [selectedDiagram, setSelectedDiagram] = useState(props.defaultValue);

  const loadDocument = async (idx: number) => {
    const ref = props.diagrams[idx];

    const fileLoader = getFileLoaderForUrl(ref.url);
    assert.present(fileLoader, `File loader for ${ref.url} not found`);

    props.onChange(loadFileFromUrl(ref.url, props.documentFactory, props.diagramFactory));
  };

  return (
    <Select
      onValueChange={v => {
        setSelectedDiagram(Number(v));
        loadDocument(Number(v));
      }}
      value={selectedDiagram.toString()}
      values={props.diagrams.map((d, idx) => ({
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
  defaultValue: number;
  onChange: (document: Promise<DiagramDocument>) => void;
};
