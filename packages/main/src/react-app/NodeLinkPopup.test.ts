import { describe, expect, it } from 'vitest';
import type { Diagram } from '@diagram-craft/model/diagram';
import { _test } from './NodeLinkPopup';

const {
  getDefaultEdgeStylesheetIds,
  getEdgeStylesheetIds,
  getNodeStencilIds,
  NO_SHAPE_ID
} = _test;

describe('NodeLinkPopup helpers', () => {
  describe('getDefaultEdgeStylesheetIds', () => {
    const makeDiagram = (
      recentIds: string[],
      allIds: string[],
      activeId: string
    ) =>
      ({
        document: {
          props: {
            recentEdgeStylesheets: {
              stylesheets: recentIds
            }
          },
          styles: {
            edgeStyles: allIds.map(id => ({ id })),
            activeEdgeStylesheet: { id: activeId },
            getEdgeStyle: (id: string) => allIds.map(edgeId => ({ id: edgeId })).find(s => s.id === id)
          }
        }
      }) as unknown as Diagram;

    it('should show all edge stylesheets when there are 8 or fewer', () => {
      expect(
        getDefaultEdgeStylesheetIds(makeDiagram([], ['default-edge', 'edge-2', 'edge-3'], 'default-edge'))
      ).toEqual(['default-edge', 'edge-2', 'edge-3']);
    });

    it('should use LRU ordering when there are more than 8 edge stylesheets', () => {
      expect(
        getDefaultEdgeStylesheetIds(
          makeDiagram(
            ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
            ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            'j'
          )
        )
      ).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });

    it('should use exact custom edge stylesheet ids in order and skip missing ids', () => {
      expect(
        getEdgeStylesheetIds(makeDiagram([], ['edge-1', 'edge-2', 'edge-3'], 'edge-1'), {
          edgeStylesheetIds: ['edge-3', 'missing', 'edge-1']
        })
      ).toEqual(['edge-3', 'edge-1']);
    });

    it('should allow custom edge stylesheet ids to produce an empty popup section', () => {
      expect(
        getEdgeStylesheetIds(makeDiagram([], ['edge-1', 'edge-2'], 'edge-1'), {
          edgeStylesheetIds: []
        })
      ).toEqual([]);
    });
  });

  describe('getNodeStencilIds', () => {
    const makeDiagram = (
      recentIds: string[],
      allIds: string[],
      basicShapeIds: string[]
    ) =>
      ((stencils => ({
        document: {
          props: {
            recentStencils: {
              stencils: recentIds
            }
          },
          registry: {
            stencils: {
              getStencils: () => [
                {
                  stencils
                }
              ],
              getStencil: (id: string) => stencils.find(s => s.id === id),
              get: () => ({
                stencils: basicShapeIds
                  .map(id => stencils.find(s => s.id === id))
                  .filter(s => s !== undefined)
              })
            }
          }
        }
      }))(
        allIds.map(id => ({
          id,
          forPicker: () => ({
            elements: [{ type: 'node' }],
            diagram: { document: { release: () => {} } }
          })
        }))
      )) as unknown as Diagram;

    it('should show all available shapes when there are 16 or fewer', () => {
      expect(
        getNodeStencilIds(
          makeDiagram([], ['default@@text', 'default@@rect', 'a', 'b', 'c'], ['a', 'b', 'c'])
        )
      ).toEqual([NO_SHAPE_ID, 'default@@text', 'default@@rect', 'a', 'b', 'c']);
    });

    it('should cap the result at 16 and prioritize recents plus basic shapes', () => {
      const allIds = [
        'default@@text',
        'default@@rect',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j',
        'k',
        'l',
        'm',
        'n',
        'o'
      ];

      expect(
        getNodeStencilIds(
          makeDiagram(['m', 'l', 'k'], allIds, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'])
        )
      ).toEqual([
        NO_SHAPE_ID,
        'default@@text',
        'default@@rect',
        'm',
        'l',
        'k',
        'a',
        'b',
        'c',
        'd',
        'e',
        'f',
        'g',
        'h',
        'i',
        'j'
      ]);
    });

    it('should use exact custom node stencil ids in order and skip missing ids', () => {
      expect(
        getNodeStencilIds(
          makeDiagram([], ['default@@text', 'default@@rect', 'a', 'b', 'c'], ['a', 'b', 'c']),
          {
            nodeStencilIds: ['b', 'missing', NO_SHAPE_ID, 'a']
          }
        )
      ).toEqual(['b', NO_SHAPE_ID, 'a']);
    });

    it('should allow custom node stencil ids to produce an empty popup section', () => {
      expect(
        getNodeStencilIds(
          makeDiagram([], ['default@@text', 'default@@rect', 'a', 'b', 'c'], ['a', 'b', 'c']),
          {
            nodeStencilIds: []
          }
        )
      ).toEqual([]);
    });
  });
});
