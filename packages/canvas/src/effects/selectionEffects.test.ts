import { describe, expect, test } from 'vitest';
import type { Selection } from '@diagram-craft/model/selection';
import type { NodePropsForRendering } from '@diagram-craft/model/diagramNode';
import { resolveResizeCompensation, resolveSelectionProjection } from './selectionEffects';

const createProps = (
  overrides: Partial<NonNullable<NodePropsForRendering['effects']>['isometric']> = {}
) =>
  ({
    effects: {
      isometric: {
        enabled: true,
        shape: 'rect',
        size: 10,
        color: '#eeeeee',
        strokeColor: '#000000',
        strokeEnabled: false,
        tilt: 0.6,
        rotation: 45,
        ...overrides
      }
    }
  }) as NodePropsForRendering;

const makeSelection = (
  nodes: Array<{
    renderProps: NodePropsForRendering;
    labelEdge: () => unknown;
  }>,
  type: Selection['type'] = 'nodes'
) =>
  ({
    nodes,
    type
  }) as Selection;

describe('resolveSelectionProjection', () => {
  test('returns a projection when all selected non-label nodes share the same projection', () => {
    const selection = makeSelection([
      { renderProps: createProps({ tilt: 0.6, rotation: 45 }), labelEdge: () => undefined },
      { renderProps: createProps({ tilt: 0.6, rotation: 45, color: '#00ff00' }), labelEdge: () => undefined }
    ]);

    const projection = resolveSelectionProjection(selection);

    expect(projection).toBeDefined();
    expect(projection?.transform({ x: 0, y: 0, w: 100, h: 60, r: 0 })).toMatch(/^matrix\(/);
  });

  test('returns no projection for mixed settings', () => {
    const selection = makeSelection([
      { renderProps: createProps({ tilt: 0.6, rotation: 45 }), labelEdge: () => undefined },
      { renderProps: createProps({ tilt: 0.5, rotation: 45 }), labelEdge: () => undefined }
    ]);

    expect(resolveSelectionProjection(selection)).toBeUndefined();
  });
});

describe('resolveResizeCompensation', () => {
  test('returns compensation for a single isometric node selection', () => {
    const selection = makeSelection(
      [{ renderProps: createProps({ enabled: true }), labelEdge: () => undefined }],
      'single-node'
    );

    const compensation = resolveResizeCompensation(selection);

    expect(compensation).toBeDefined();
    expect(
      compensation?.compensate(
        { x: 0, y: 0, w: 100, h: 80, r: 0 },
        { x: 0, y: 0, w: 140, h: 80, r: 0 },
        'e'
      ).x
    ).not.toBe(0);
  });

  test('returns no compensation for non-isometric or multi-node selections', () => {
    const plainSingle = makeSelection(
      [{ renderProps: createProps({ enabled: false }), labelEdge: () => undefined }],
      'single-node'
    );
    const multi = makeSelection([
      { renderProps: createProps({ enabled: true }), labelEdge: () => undefined },
      { renderProps: createProps({ enabled: true }), labelEdge: () => undefined }
    ]);

    expect(resolveResizeCompensation(plainSingle)).toBeUndefined();
    expect(resolveResizeCompensation(multi)).toBeUndefined();
  });
});
