import { describe, expect, test } from 'vitest';
import { parseAndroidShapes } from './android';
import { StyleManager } from '../../styleManager';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { Box } from '@diagram-craft/geometry/box';

describe('parseAndroidShapes', () => {
  test('clamps quickscroll3 dy imported from draw.io styles', async () => {
    const { layer } = TestModel.newDiagramWithLayer();

    const low = await parseAndroidShapes(
      'low',
      Box.unit(),
      {},
      {},
      { text: '' },
      new StyleManager('shape=mxgraph.android.quickscroll3;dy=-0.2'),
      layer
    );

    const high = await parseAndroidShapes(
      'high',
      Box.unit(),
      {},
      {},
      { text: '' },
      new StyleManager('shape=mxgraph.android.quickscroll3;dy=1.2'),
      layer
    );

    expect(low.storedProps.custom?.androidQuickscroll3?.dy).toBe(0);
    expect(high.storedProps.custom?.androidQuickscroll3?.dy).toBe(1);
  });
});
