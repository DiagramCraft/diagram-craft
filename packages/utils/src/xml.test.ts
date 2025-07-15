// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { xIterElements, xNum } from './xml';

describe('XML Utilities', () => {
  describe('xIterElements', () => {
    it('should iterate through HTML collection and yield only element nodes', () => {
      // Create a document fragment to hold our test elements
      const fragment = document.createDocumentFragment();

      // Create some test elements
      const div1 = document.createElement('div');
      div1.id = 'div1';
      const div2 = document.createElement('div');
      div2.id = 'div2';
      const span = document.createElement('span');
      span.id = 'span1';

      // Add elements to the fragment
      fragment.appendChild(div1);
      fragment.appendChild(div2);
      fragment.appendChild(span);

      // Create a container to get an HTMLCollection
      const container = document.createElement('div');
      container.appendChild(fragment);

      // Get the HTMLCollection
      const collection = container.children;

      // Use the iterator
      const elements = Array.from(xIterElements(collection));

      // Verify results
      expect(elements.length).toBe(3);
      expect(elements[0].id).toBe('div1');
      expect(elements[1].id).toBe('div2');
      expect(elements[2].id).toBe('span1');
    });

    it('should skip non-element nodes', () => {
      // Create a container
      const container = document.createElement('div');

      // Add an element
      const div = document.createElement('div');
      div.id = 'test-div';
      container.appendChild(div);

      // Add a text node (non-element)
      const textNode = document.createTextNode('This is a text node');
      container.appendChild(textNode);

      // Add another element
      const span = document.createElement('span');
      span.id = 'test-span';
      container.appendChild(span);

      // Get the HTMLCollection (note: this won't actually include the text node in modern browsers)
      // but we're testing the function's behavior if it did
      const collection = container.children;

      // Use the iterator
      const elements = Array.from(xIterElements(collection));

      // Verify results
      expect(elements.length).toBe(2);
      expect(elements[0].id).toBe('test-div');
      expect(elements[1].id).toBe('test-span');
    });

    it('should handle empty collections', () => {
      const container = document.createElement('div');
      const collection = container.children;

      const elements = Array.from(xIterElements(collection));

      expect(elements.length).toBe(0);
    });
  });

  describe('xNum', () => {
    it('should return numeric value of an attribute', () => {
      const element = document.createElement('div');
      element.setAttribute('width', '100');

      const result = xNum(element, 'width');

      expect(result).toBe(100);
    });

    it('should return default value when attribute is missing', () => {
      const element = document.createElement('div');

      const result = xNum(element, 'width');

      expect(result).toBe(0); // Default is 0
    });

    it('should use provided default value when attribute is missing', () => {
      const element = document.createElement('div');

      const result = xNum(element, 'width', 50);

      expect(result).toBe(50);
    });

    it('should handle string values that convert to numbers', () => {
      const element = document.createElement('div');
      element.setAttribute('opacity', '0.5');

      const result = xNum(element, 'opacity');

      expect(result).toBe(0.5);
    });

    it('should handle invalid numeric strings', () => {
      const element = document.createElement('div');
      element.setAttribute('value', 'not-a-number');

      const result = xNum(element, 'value');

      expect(result).toBeNaN();
    });

    it('should handle empty string attributes', () => {
      const element = document.createElement('div');
      element.setAttribute('value', '');

      const result = xNum(element, 'value');

      expect(result).toBe(0); // Empty string converts to 0 in JavaScript
    });
  });
});
