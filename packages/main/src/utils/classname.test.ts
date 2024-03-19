import { describe, expect, test } from 'vitest';
import { $c } from './classname';

describe('$c function', () => {
  test('should generate a BEM class name with no modifiers when none are provided', () => {
    const result = $c('button', {});
    expect(result).to.equal('button');
  });

  test('should generate a BEM class name with one modifier when one is provided and true', () => {
    const result = $c('button', { large: true });
    expect(result).to.equal('button button--large');
  });

  test('should not include a modifier in the class name when its value is false', () => {
    const result = $c('button', { large: false });
    expect(result).to.equal('button');
  });

  test('should generate a BEM class name with multiple modifiers when multiple are provided and true', () => {
    const result = $c('button', { large: true, primary: true });
    expect(result).to.equal('button button--large button--primary');
  });

  test('should not include modifiers in the class name when their values are false', () => {
    const result = $c('button', { large: false, primary: false });
    expect(result).to.equal('button');
  });

  test('should handle a mix of true and false modifier values', () => {
    const result = $c('button', { large: true, primary: false });
    expect(result).to.equal('button button--large');
  });
});
