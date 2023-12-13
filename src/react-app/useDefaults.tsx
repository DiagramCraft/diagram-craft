import { useConfiguration } from './context/ConfigurationContext.tsx';

export const useNodeDefaults = () => {
  const config = useConfiguration();
  return config.defaults.node;
};

export const useEdgeDefaults = () => {
  const config = useConfiguration();
  return config.defaults.edge;
};
