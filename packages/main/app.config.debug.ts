import { defineAppConfig } from './src/appConfig';

/**
 * Debug configuration for the application that overrides default settings based on URL parameters.
 *
 * Supports the following URL parameters:
 * - name: Override the awareness user name
 * - color: Override the awareness user color
 * - crdtClear=true: Force clear server state
 * - crdtLoadFromServer=true: Force load state from server
 * - state.key: Override the state key
 *
 * Falls back to default values if URL parameters are not present.
 *
 * Enable by setting env variable `APP_CONFIG=app.config.debug.ts`
 */
export default defineAppConfig(config => {
  const defaultAwarenessNameFn = config.awareness.name;
  const defaultAwarenessColorFn = config.awareness.color;
  const defaultStateKeyFn = config.state.key;

  config.awareness.name = () => {
    return new URLSearchParams(location.search).get('name') ?? defaultAwarenessNameFn();
  };
  config.awareness.color = () => {
    return new URLSearchParams(location.search).get('color') ?? defaultAwarenessColorFn();
  };
  config.collaboration.forceClearServerState = () => location.search.includes('crdtClear=true');

  config.collaboration.forceLoadFromServer = () =>
    location.search.includes('crdtLoadFromServer=true');

  config.state.key = () =>
    new URLSearchParams(location.search).get('state.key') ?? defaultStateKeyFn();

  return config;
});
