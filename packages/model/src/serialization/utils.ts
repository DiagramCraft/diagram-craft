import type {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedFreeEndpoint,
  SerializedPointInNodeEndpoint
} from './types';

export const isSerializedEndpointAnchor = (
  endpoint: SerializedEndpoint
): endpoint is SerializedAnchorEndpoint => 'node' in endpoint && 'anchor' in endpoint;

export const isSerializedEndpointConnected = (
  endpoint: SerializedEndpoint
): endpoint is SerializedPointInNodeEndpoint => 'node' in endpoint && !('anchor' in endpoint);

export const isSerializedEndpointFree = (
  endpoint: SerializedEndpoint
): endpoint is SerializedFreeEndpoint => !('node' in endpoint);
