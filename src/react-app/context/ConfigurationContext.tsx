import React from 'react';
import { assert } from '../../utils/assert.ts';
import { DeepRequired } from 'ts-essentials';

type ConfigurationContextType = {
  palette: {
    primary: string[];
    secondary: string[][];
  };

  fonts: Record<string, string>;

  defaults: {
    node: DeepRequired<NodeProps>;
    edge: DeepRequired<EdgeProps>;
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
