import { describe, expect, it } from 'vitest';
import { DiagramPalette } from './diagramPalette';
import { Backends } from './collaboration/yjs/collaborationTestUtils';

const DEFAULT_COLOR = '#000000';

describe.each(Backends.all())('DiagramPalette [%s]', (_name, backend) => {
  describe('constructor', () => {
    it('should initialize the palette with default colors if empty', () => {
      // Setup
      const [root1] = backend.syncedDocs();

      // Act
      const palette = new DiagramPalette(root1, 10);

      // Verify
      expect(palette.colors).toHaveLength(10);
      expect(palette.colors[0]).toBe(DEFAULT_COLOR);
    });
  });

  describe('setColor', () => {
    it('should set the color of the specified index', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const palette1 = new DiagramPalette(root1, 10);
      const palette2 = root2 ? new DiagramPalette(root2, 10) : undefined;

      // Act
      palette1.setColor(0, '#AAAAAA');

      // Verify
      expect(palette1.colors[0]).toBe('#AAAAAA');
      if (palette2) expect(palette2.colors[0]).toBe('#AAAAAA');

      // Act
      palette1.setColor(0, '#BBBBBB');

      // Verify
      expect(palette1.colors[0]).toBe('#BBBBBB');
      if (palette2) expect(palette2.colors[0]).toBe('#BBBBBB');
    });
  });

  describe('setColors', () => {
    it('should set the colors of the palette', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const palette1 = new DiagramPalette(root1, 10);
      const palette2 = root2 ? new DiagramPalette(root2, 10) : undefined;

      // Act
      palette1.setColors(['#000000', '#ffffff']);

      // Verify
      expect(palette1.colors).toHaveLength(2);
      expect(palette1.colors[0]).toBe('#000000');
      expect(palette1.colors[1]).toBe('#ffffff');

      if (palette2) {
        expect(palette2.colors).toHaveLength(2);
        expect(palette2.colors[0]).toBe('#000000');
        expect(palette2.colors[1]).toBe('#ffffff');
      }
    });
  });
});
