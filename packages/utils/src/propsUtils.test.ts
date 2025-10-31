import { describe, expect, test } from 'vitest';
import { PropsUtils } from './propsUtils';

describe('propsUtils', () => {
  test('isValidDomAttribute returns true for valid DOM attribute', () => {
    expect(PropsUtils.isValidDomAttribute('accept')).toBe(true);
  });

  test('isValidDomAttribute returns false for invalid DOM attribute', () => {
    expect(PropsUtils.isValidDomAttribute('invalidAttr')).toBe(false);
  });

  test('isValidSvgAttribute returns true for valid SVG attribute', () => {
    expect(PropsUtils.isValidSvgAttribute('accentHeight')).toBe(true);
  });

  test('isValidSvgAttribute returns false for invalid SVG attribute', () => {
    expect(PropsUtils.isValidSvgAttribute('invalidAttr')).toBe(false);
  });

  test('filterDomProperties removes invalid DOM attributes', () => {
    const props = { accept: 'value', invalidAttr: 'value' };
    expect(PropsUtils.filterDomProperties(props)).toEqual({ accept: 'value' });
  });

  test('filterSvgProperties removes invalid SVG attributes', () => {
    const props = { accentHeight: 'value', invalidAttr: 'value' };
    expect(PropsUtils.filterSvgProperties(props)).toEqual({ accentHeight: 'value' });
  });

  test('filter removes specified keys from props', () => {
    const props = { key1: 'value1', key2: 'value2' };
    expect(PropsUtils.filter(props, 'key1')).toEqual({ key2: 'value2' });
  });

  test('isValidDomAttribute returns true for data- attributes', () => {
    expect(PropsUtils.isValidDomAttribute('data-custom')).toBe(true);
  });

  test('isValidSvgAttribute returns true for aria- attributes', () => {
    expect(PropsUtils.isValidSvgAttribute('aria-label')).toBe(true);
  });

  test('filterDomProperties removes specified keys from props', () => {
    const props = { accept: 'value', invalidAttr: 'value' };
    expect(PropsUtils.filterDomProperties(props, 'accept')).toEqual({});
  });

  test('filterSvgProperties removes specified keys from props', () => {
    const props = { accentHeight: 'value', invalidAttr: 'value' };
    expect(PropsUtils.filterSvgProperties(props, 'accentHeight')).toEqual({});
  });
});
