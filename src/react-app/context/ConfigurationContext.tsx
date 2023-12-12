import React from 'react';
import { assert } from '../../utils/assert.ts';

type ConfigurationContextType = {
  palette: {
    primary: string[];
    secondary: string[][];
  };

  defaults?: {
    node?: NodeProps;
    edge?: EdgeProps;
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
