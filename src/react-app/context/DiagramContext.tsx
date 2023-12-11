import { EditableDiagram } from '../../model-editor/editable-diagram.ts';
import React from 'react';
import { assert } from '../../utils/assert.ts';

export const DiagramContext = React.createContext<EditableDiagram | undefined>(undefined);

export const useDiagram = () => {
  const diagram = React.useContext(DiagramContext);
  assert.present(diagram);
  return diagram;
};
