import type {
  SerializedAnchorEndpoint,
  SerializedEndpoint,
  SerializedFreeEndpoint,
  SerializedPointInNodeEndpoint
} from './serializedTypes';

export const isSerializedEndpointAnchor = (
  endpoint: SerializedEndpoint
): endpoint is SerializedAnchorEndpoint => 'anchor' in endpoint;

export const isSerializedEndpointPointInNode = (
  endpoint: SerializedEndpoint
): endpoint is SerializedPointInNodeEndpoint => !('anchor' in endpoint) && 'node' in endpoint;

export const isSerializedEndpointFree = (
  endpoint: SerializedEndpoint
): endpoint is SerializedFreeEndpoint => !('node' in endpoint);
