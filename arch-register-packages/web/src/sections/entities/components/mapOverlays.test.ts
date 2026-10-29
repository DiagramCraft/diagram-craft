import { describe, expect, it } from 'vitest';
import { computeHighlightedIds, isMapOverlayConfig, resolveMapOverlays } from './mapOverlays';
import type { RenderTreeNode } from './mapViewTraversal';

const node = (uid: string, name: string, owner: string | null, children: RenderTreeNode[] = []) =>
  ({
    node: { _uid: uid, _name: name, _owner: owner ? { id: owner } : null },
    levelIndex: 0,
    children
  }) as unknown as RenderTreeNode;

const tree = [
  node('a', 'Payments', 'o1', [node('b', 'Card payments', 'o2'), node('c', 'Invoicing', 'o1')]),
  node('d', 'Logistics', 'o2')
];

describe('computeHighlightedIds', () => {
  it('dims nothing without a search or owner filter', () => {
    expect(computeHighlightedIds(tree, '  ', [])).toBeNull();
    expect(computeHighlightedIds(tree, '', undefined)).toBeNull();
  });

  it('matches names case-insensitively at every depth', () => {
    expect([...computeHighlightedIds(tree, 'PAYMENTS', [])!]).toEqual(['a', 'b']);
  });

  it('keeps only boxes owned by one of the owners', () => {
    expect([...computeHighlightedIds(tree, '', ['o2'])!]).toEqual(['b', 'd']);
  });

  it('combines search and owner', () => {
    expect([...computeHighlightedIds(tree, 'pay', ['o1'])!]).toEqual(['a']);
  });
});

describe('resolveMapOverlays', () => {
  const schema = {
    id: 'sch_bc',
    name: 'Business Capability',
    fields: [
      { id: 'maturity', name: 'Maturity', type: 'number' },
      { id: 'gap', name: 'Maturity Gap', type: 'derived' }
    ]
  } as never;
  const bands = [
    { max: 2.5, tone: 'bad' as const },
    { max: null, tone: 'good' as const }
  ];

  it('resolves a field by name or id, labelling it with the field name by default', () => {
    const resolved = resolveMapOverlays(
      [
        { fieldId: 'Maturity', aggregation: 'average', colourBands: bands },
        { fieldId: 'gap', label: 'Gap', aggregation: 'sum', colourBands: bands }
      ],
      schema
    )!;
    expect(resolved.map(o => [o.id, o.label])).toEqual([
      ['maturity', 'Maturity'],
      ['gap', 'Gap']
    ]);
    expect(resolved[0]!.metricConfig).toMatchObject({
      sourceSchemaId: 'sch_bc',
      source: { kind: 'field', fieldId: 'maturity' },
      aggregation: 'average',
      colourBands: bands
    });
  });

  it('drops overlays naming an unknown field, and is undefined when none remain or authored', () => {
    expect(
      resolveMapOverlays([{ fieldId: 'Nope', aggregation: 'sum', colourBands: bands }], schema)
    ).toEqual([]);
    expect(resolveMapOverlays([], schema)).toBeUndefined();
    expect(resolveMapOverlays(undefined, schema)).toBeUndefined();
  });

  it('validates the authored shape', () => {
    expect(isMapOverlayConfig({ fieldId: 'a', aggregation: 'sum', colourBands: bands })).toBe(true);
    expect(isMapOverlayConfig({ fieldId: 'a', aggregation: 'median', colourBands: bands })).toBe(
      false
    );
    expect(
      isMapOverlayConfig({ fieldId: 'a', aggregation: 'sum', colourBands: [{ max: 1, tone: 'x' }] })
    ).toBe(false);
  });
});
