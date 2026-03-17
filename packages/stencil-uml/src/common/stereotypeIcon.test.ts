import { describe, expect, test } from 'vitest';
import {
  renderStereotypeIcon,
  UML_STEREOTYPE_ICON_OPTIONS
} from '@diagram-craft/stencil-uml/common/stereotypeIcon';

describe('stereotypeIcon', () => {
  test('includes artifact in stereotype icon options', () => {
    expect(UML_STEREOTYPE_ICON_OPTIONS).toContainEqual({
      value: 'artifact',
      label: 'Artifact'
    });
  });

  test('renders artifact as a folded document icon', () => {
    const icon = renderStereotypeIcon(
      { x: 10, y: 20, w: 100, h: 60, r: 0 },
      'artifact',
      {
        stroke: { enabled: true, color: '#123456', width: 2 },
        fill: { enabled: true, color: '#abcdef' }
      }
    );

    expect(icon).toMatchObject({
      tag: 'g',
      data: {
        transform: 'translate(90 26)',
        style: 'pointer-events: none'
      }
    });
    expect(icon?.children).toHaveLength(1);
    expect(icon?.children[0]).toMatchObject({
      tag: 'path',
      data: {
        d: 'M 2.333,0 L 9.667,0 L 12.667,3 L 12.667,14 L 2.333,14 Z M 9.667,0 L 9.667,3 L 12.667,3',
        fill: '#abcdef',
        stroke: '#123456',
        'stroke-width': 1.8,
        'stroke-linejoin': 'round'
      }
    });
  });

  test('returns nothing for the empty stereotype icon', () => {
    expect(
      renderStereotypeIcon(
        { x: 0, y: 0, w: 50, h: 20, r: 0 },
        'empty',
        {
          stroke: { enabled: true, color: '#000', width: 1 },
          fill: { enabled: true, color: '#fff' }
        }
      )
    ).toBeUndefined();
  });
});
