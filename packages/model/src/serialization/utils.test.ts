import { describe, expect, it } from 'vitest';
import {
  isSerializedEndpointAnchor,
  isSerializedEndpointPointInNode,
  isSerializedEndpointFree
} from './utils';
import type {
  SerializedAnchorEndpoint,
  SerializedFreeEndpoint,
  SerializedPointInNodeEndpoint
} from './serializedTypes';

describe('Serialized Endpoint Type Guards', () => {
  // Test data
  const nodeRef = { id: 'node-1' };

  const anchorEndpoint: SerializedAnchorEndpoint = {
    node: nodeRef,
    anchor: 'center',
    offset: { x: 0, y: 0 }
  };

  const connectedEndpoint: SerializedPointInNodeEndpoint = {
    node: nodeRef,
    offset: { x: 0, y: 0 }
  };

  const freeEndpoint: SerializedFreeEndpoint = {
    position: { x: 100, y: 100 }
  };

  describe('isSerializedEndpointAnchor', () => {
    it('should return true for anchor endpoints', () => {
      expect(isSerializedEndpointAnchor(anchorEndpoint)).toBe(true);
    });

    it('should return false for connected endpoints', () => {
      expect(isSerializedEndpointAnchor(connectedEndpoint)).toBe(false);
    });

    it('should return false for free endpoints', () => {
      expect(isSerializedEndpointAnchor(freeEndpoint)).toBe(false);
    });
  });

  describe('isSerializedEndpointConnected', () => {
    it('should return true for connected endpoints', () => {
      expect(isSerializedEndpointPointInNode(connectedEndpoint)).toBe(true);
    });

    it('should return false for anchor endpoints', () => {
      expect(isSerializedEndpointPointInNode(anchorEndpoint)).toBe(false);
    });

    it('should return false for free endpoints', () => {
      expect(isSerializedEndpointPointInNode(freeEndpoint)).toBe(false);
    });
  });

  describe('isSerializedEndpointFree', () => {
    it('should return true for free endpoints', () => {
      expect(isSerializedEndpointFree(freeEndpoint)).toBe(true);
    });

    it('should return false for anchor endpoints', () => {
      expect(isSerializedEndpointFree(anchorEndpoint)).toBe(false);
    });

    it('should return false for connected endpoints', () => {
      expect(isSerializedEndpointFree(connectedEndpoint)).toBe(false);
    });
  });
});
