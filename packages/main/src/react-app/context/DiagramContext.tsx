import React from 'react';
import { assert } from '../../utils/assert.ts';
import { Diagram } from '../../model/diagram.ts';

export const DiagramContext = React.createContext<Diagram | undefined>(undefined);

export const useDiagram = () => {
  const diagram = React.useContext(DiagramContext);
  assert.present(diagram);
  return diagram;
};
