import React from 'react';
import { assert } from '@diagram-craft/utils/assert';
import { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { EdgePropsForRendering } from '@diagram-craft/model/diagramEdge';

type ConfigurationContextType = {
  palette: {
    primary: string[][];
  };

  fonts: Record<string, string>;

  defaults: {
    node: NodePropsForRendering;
    edge: EdgePropsForRendering;
  };

  // TODO: Add styles, patterns, fonts etc
};

export const ConfigurationContext = React.createContext<ConfigurationContextType | undefined>(
  undefined
);

export const useConfiguration = () => {
  const configuration = React.useContext(ConfigurationContext);
  assert.present(configuration);
  return configuration;
};
