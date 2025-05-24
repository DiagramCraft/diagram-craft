// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { getAncestorWithClass, setPosition } from './dom';

describe('setPosition', () => {
  it('should set the correct left and top styles on the element', () => {
    const element = document.createElement('div');
    const position = { x: 100, y: 200 };

    setPosition(element, position);

    expect(element.style.left).toBe('100px');
    expect(element.style.top).toBe('200px');
  });

  it('should handle zero coordinates correctly', () => {
    const element = document.createElement('div');
    const position = { x: 0, y: 0 };

    setPosition(element, position);

    expect(element.style.left).toBe('0px');
    expect(element.style.top).toBe('0px');
  });

  it('should handle negative coordinates correctly', () => {
    const element = document.createElement('div');
    const position = { x: -50, y: -75 };

    setPosition(element, position);

    expect(element.style.left).toBe('-50px');
    expect(element.style.top).toBe('-75px');
  });
});

describe('getAncestorWithClass', () => {
  it('should return the closest ancestor with the specified class', () => {
    const ancestor = document.createElement('div');
    ancestor.classList.add('target-class');
    const parent = document.createElement('div');
    const child = document.createElement('div');

    ancestor.appendChild(parent);
    parent.appendChild(child);

    expect(getAncestorWithClass(child, 'target-class')).toBe(ancestor);
  });

  it('should return undefined if no ancestor with the specified class exists', () => {
    const parent = document.createElement('div');
    const child = document.createElement('div');

    parent.appendChild(child);

    expect(getAncestorWithClass(child, 'nonexistent-class')).toBeUndefined();
  });

  it('should return the element itself if it has the specified class', () => {
    const element = document.createElement('div');
    element.classList.add('self-class');

    expect(getAncestorWithClass(element, 'self-class')).toBe(element);
  });

  it('should return undefined if the provided element is null', () => {
    expect(getAncestorWithClass(null as unknown as HTMLElement, 'target-class')).toBeUndefined();
  });

  it('should return undefined if the DOM tree is empty', () => {
    const isolatedElement = document.createElement('div');

    expect(getAncestorWithClass(isolatedElement, 'some-class')).toBeUndefined();
  });
});
