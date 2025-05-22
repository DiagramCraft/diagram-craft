import { describe, expect, it } from 'vitest';
import { DiagramPalette } from './diagramPalette';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';

const DEFAULT_COLOR = '#000000';

describe('DiagramPalette', () => {
  describe('constructor', () => {
    it('should initialize the palette with default colors if empty', () => {
      const doc = new NoOpCRDTRoot();
      const palette = new DiagramPalette(doc, 10);

      expect(palette.colors).toHaveLength(10);
      expect(palette.colors[0]).toBe(DEFAULT_COLOR);
    });
  });

  describe('setColor', () => {
    it('should set the color of the specified index', () => {
      const doc = new NoOpCRDTRoot();
      const palette = new DiagramPalette(doc, 10);
      palette.setColor(0, '#000000');
      palette.setColor(1, '#ffffff');
      expect(palette.colors).toHaveLength(10);
      expect(palette.colors[0]).toBe('#000000');
      expect(palette.colors[1]).toBe('#ffffff');
    });
  });

  describe('setColors', () => {
    it('should set the colors of the palette', () => {
      const doc = new NoOpCRDTRoot();
      const palette = new DiagramPalette(doc, 10);
      palette.setColors(['#000000', '#ffffff']);
      expect(palette.colors).toHaveLength(2);
      expect(palette.colors[0]).toBe('#000000');
      expect(palette.colors[1]).toBe('#ffffff');
    });
  });
});
