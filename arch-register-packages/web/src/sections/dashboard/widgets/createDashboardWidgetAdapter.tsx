import type { ComponentType } from 'react';

export const createDashboardWidgetAdapter = <
  Config extends Record<string, unknown>,
  Props extends Record<string, unknown>
>(
  Component: ComponentType<Props>,
  mapConfigToProps: (config: Config) => Props
): ComponentType<{ config: Config }> => {
  return ({ config }: { config: Config }) => <Component {...mapConfigToProps(config)} />;
};
