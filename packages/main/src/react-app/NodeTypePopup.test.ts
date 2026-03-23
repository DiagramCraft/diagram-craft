import { describe, expect, it } from 'vitest';
import type { Diagram } from '@diagram-craft/model/diagram';
import { _test } from './NodeTypePopup';

const {
  getRecentEdgeStylesheetIds,
  getNodeStencilIds,
  NO_SHAPE_ID
} = _test;

describe('NodeTypePopup helpers', () => {
  describe('getRecentEdgeStylesheetIds', () => {
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
            activeEdgeStylesheet: { id: activeId }
          }
        }
      }) as unknown as Diagram;

    it('should show all edge stylesheets when there are 8 or fewer', () => {
      expect(getRecentEdgeStylesheetIds(makeDiagram([], ['default-edge', 'edge-2', 'edge-3'], 'default-edge'))).toEqual([
        'default-edge',
        'edge-2',
        'edge-3'
      ]);
    });

    it('should use LRU ordering when there are more than 8 edge stylesheets', () => {
      expect(
        getRecentEdgeStylesheetIds(
          makeDiagram(
            ['a', 'b', 'a', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
            ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'],
            'j'
          )
        )
      ).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
    });
  });

  describe('getNodeStencilIds', () => {
    const makeDiagram = (
      recentIds: string[],
      allIds: string[],
      basicShapeIds: string[]
    ) =>
      ({
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
                  stencils: allIds.map(id => ({
                    id,
                    forPicker: () => ({
                      elements: [{ type: 'node' }],
                      diagram: { document: { release: () => {} } }
                    })
                  }))
                }
              ],
              get: () => ({
                stencils: basicShapeIds.map(id => ({
                  id,
                  forPicker: () => ({
                    elements: [{ type: 'node' }],
                    diagram: { document: { release: () => {} } }
                  })
                }))
              })
            }
          }
        }
      }) as unknown as Diagram;

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
  });
});
