import { describe, expect, it } from 'vitest';
import { DiagramPalette } from '../../diagramPalette';
import { createSyncedYJSCRDTs } from './yjsTest';

describe('DiagramPalette', () => {
  describe('setColor', () => {
    it('should set the color of the specified index', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const palette1 = new DiagramPalette(doc1, 10);
      const palette2 = new DiagramPalette(doc2, 10);

      palette1.setColor(0, '#AAAAAA');

      expect(palette1.colors[0]).toBe('#AAAAAA');
      expect(palette2.colors[0]).toBe('#AAAAAA');

      palette2.setColor(1, '#FFFFCC');

      expect(palette1.colors[1]).toBe('#FFFFCC');
      expect(palette2.colors[1]).toBe('#FFFFCC');
    });
  });

  describe('setColors', () => {
    it('should set the colors of the palette', () => {
      const { doc1, doc2 } = createSyncedYJSCRDTs();

      const palette1 = new DiagramPalette(doc1, 10);
      const palette2 = new DiagramPalette(doc2, 10);

      palette1.setColors(['#000000', '#ffffff']);
      expect(palette1.colors).toHaveLength(2);
      expect(palette1.colors[0]).toBe('#000000');
      expect(palette1.colors[1]).toBe('#ffffff');

      expect(palette2.colors).toHaveLength(2);
      expect(palette2.colors[0]).toBe('#000000');
      expect(palette2.colors[1]).toBe('#ffffff');
    });
  });
});
