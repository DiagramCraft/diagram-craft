import { describe, expect, test } from 'vitest';
import { propsUtils } from './propsUtils';

describe('propsUtils', () => {
  test('isValidDomAttribute returns true for valid DOM attribute', () => {
    expect(propsUtils.isValidDomAttribute('accept')).toBe(true);
  });

  test('isValidDomAttribute returns false for invalid DOM attribute', () => {
    expect(propsUtils.isValidDomAttribute('invalidAttr')).toBe(false);
  });

  test('isValidSvgAttribute returns true for valid SVG attribute', () => {
    expect(propsUtils.isValidSvgAttribute('accentHeight')).toBe(true);
  });

  test('isValidSvgAttribute returns false for invalid SVG attribute', () => {
    expect(propsUtils.isValidSvgAttribute('invalidAttr')).toBe(false);
  });

  test('filterDomProperties removes invalid DOM attributes', () => {
    const props = { accept: 'value', invalidAttr: 'value' };
    expect(propsUtils.filterDomProperties(props)).toEqual({ accept: 'value' });
  });

  test('filterSvgProperties removes invalid SVG attributes', () => {
    const props = { accentHeight: 'value', invalidAttr: 'value' };
    expect(propsUtils.filterSvgProperties(props)).toEqual({ accentHeight: 'value' });
  });

  test('filter removes specified keys from props', () => {
    const props = { key1: 'value1', key2: 'value2' };
    expect(propsUtils.filter(props, 'key1')).toEqual({ key2: 'value2' });
  });

  test('isValidDomAttribute returns true for data- attributes', () => {
    expect(propsUtils.isValidDomAttribute('data-custom')).toBe(true);
  });

  test('isValidSvgAttribute returns true for aria- attributes', () => {
    expect(propsUtils.isValidSvgAttribute('aria-label')).toBe(true);
  });

  test('filterDomProperties removes specified keys from props', () => {
    const props = { accept: 'value', invalidAttr: 'value' };
    expect(propsUtils.filterDomProperties(props, 'accept')).toEqual({});
  });

  test('filterSvgProperties removes specified keys from props', () => {
    const props = { accentHeight: 'value', invalidAttr: 'value' };
    expect(propsUtils.filterSvgProperties(props, 'accentHeight')).toEqual({});
  });
});
