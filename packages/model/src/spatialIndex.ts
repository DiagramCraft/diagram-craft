import { Box } from '@diagram-craft/geometry/box';
import { Point } from '@diagram-craft/geometry/point';
import type { DiagramElement } from './diagramElement';
import { isEdge } from './diagramElement';
import type { Diagram } from './diagram';
import type { RegularLayer } from './diagramLayerRegular';
import { assert } from '@diagram-craft/utils/assert';
import { type Releasable, Releasables } from '@diagram-craft/utils/releasable';

type Direction = 'n' | 's' | 'e' | 'w';

type GridCell = Set<DiagramElement>;

function isRegularLayer(source: Diagram | RegularLayer): source is RegularLayer {
  return 'diagram' in source;
}

const GRID_SIZE = 10;

const getElementBounds = (element: DiagramElement): Box => {
  if (isEdge(element)) {
    const start = element.start?.position;
    const end = element.end?.position;
    if (!start || !end) {
      return { x: 0, y: 0, w: 0, h: 0, r: 0 };
    }
    return Box.fromCorners(start, end);
  }

  return element.bounds;
};

const getVisibleElements = (source: Diagram | RegularLayer): readonly DiagramElement[] =>
  isRegularLayer(source) ? source.elements : source.visibleElements();

export class SpatialIndex implements Releasable {
  #index: GridCell[][] | undefined;
  readonly #releasables = new Releasables();

  private readonly elementAddHandler = () => this.invalidate();
  private readonly elementRemoveHandler = () => this.invalidate();
  private readonly elementChangeHandler = () => this.invalidate();
  private readonly elementBatchChangeHandler = () => this.invalidate();

  readonly #diagram: Diagram;

  constructor(private readonly source: Diagram | RegularLayer) {
    this.#diagram = isRegularLayer(source) ? source.diagram : source;

    this.#releasables.add(this.#diagram.on('elementAdd', this.elementAddHandler));
    this.#releasables.add(this.#diagram.on('elementRemove', this.elementRemoveHandler));
    this.#releasables.add(this.#diagram.on('elementChange', this.elementChangeHandler));
    this.#releasables.add(this.#diagram.on('elementBatchChange', this.elementBatchChangeHandler));
  }

  release(): void {
    this.#releasables.release();
    this.#index = undefined;
  }

  invalidate(): void {
    this.#index = undefined;
  }

  *near(ref: Box | Point): Iterable<DiagramElement> {
    this.rebuildIndexIfNeeded();
    assert.present(this.#index);

    const point = 'w' in ref ? Box.center(ref) : ref;
    const grid = this.#index;
    const [row, col] = this.pointToCell(point);
    const yielded = new Set<DiagramElement>();

    const radius = Math.max(GRID_SIZE, GRID_SIZE);
    for (let r = 0; r <= radius; r++) {
      const ringCandidates = new Set<DiagramElement>();

      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;

          const cellRow = row + dr;
          const cellCol = col + dc;

          if (cellRow >= 0 && cellRow < GRID_SIZE && cellCol >= 0 && cellCol < GRID_SIZE) {
            const cell = grid[cellRow]?.[cellCol];
            if (cell) {
              for (const element of cell) {
                if (!yielded.has(element)) {
                  ringCandidates.add(element);
                }
              }
            }
          }
        }
      }

      if (ringCandidates.size === 0) {
        if (r > 0) break;
        continue;
      }

      const sorted = Array.from(ringCandidates).sort((a, b) => {
        const distA = this.distanceToElement(point, a);
        const distB = this.distanceToElement(point, b);
        return distA - distB;
      });

      for (const element of sorted) {
        yielded.add(element);
        yield element;
      }
    }
  }

  *inDirection(from: Point, direction: Direction): Iterable<DiagramElement> {
    this.rebuildIndexIfNeeded();
    assert.present(this.#index);

    const grid = this.#index;
    const [row, col] = this.pointToCell(from);
    const yielded = new Set<DiagramElement>();

    const radius = Math.max(GRID_SIZE, GRID_SIZE);
    for (let r = 0; r <= radius; r++) {
      const ringCandidates: DiagramElement[] = [];

      for (let dr = -r; dr <= r; dr++) {
        for (let dc = -r; dc <= r; dc++) {
          if (Math.abs(dr) !== r && Math.abs(dc) !== r) continue;

          const cellRow = row + dr;
          const cellCol = col + dc;

          if (cellRow >= 0 && cellRow < GRID_SIZE && cellCol >= 0 && cellCol < GRID_SIZE) {
            const cell = grid[cellRow]?.[cellCol];
            if (cell) {
              for (const element of cell) {
                if (yielded.has(element)) continue;

                const elementBounds = getElementBounds(element);
                const center = Box.center(elementBounds);

                let isInDirection = false;
                switch (direction) {
                  case 'n':
                    isInDirection = center.y < from.y;
                    break;
                  case 's':
                    isInDirection = center.y > from.y;
                    break;
                  case 'e':
                    isInDirection = center.x > from.x;
                    break;
                  case 'w':
                    isInDirection = center.x < from.x;
                    break;
                }

                if (isInDirection) {
                  ringCandidates.push(element);
                }
              }
            }
          }
        }
      }

      if (ringCandidates.length === 0) {
        if (r > 0) break;
        continue;
      }

      ringCandidates.sort((a, b) => {
        const distA = this.distanceToElement(from, a);
        const distB = this.distanceToElement(from, b);
        return distA - distB;
      });

      for (const element of ringCandidates) {
        yielded.add(element);
        yield element;
      }
    }
  }

  private rebuildIndexIfNeeded(): void {
    if (this.#index) return;

    this.#index = Array.from({ length: GRID_SIZE }, () =>
      Array.from({ length: GRID_SIZE }, () => new Set<DiagramElement>())
    );

    for (const element of getVisibleElements(this.source)) {
      assert.present(this.#index);

      const elementBounds = getElementBounds(element);
      const cells = this.boxToCells(elementBounds);

      for (const [row, col] of cells) {
        this.#index[row]?.[col]?.add(element);
      }
    }
  }

  private boxToCells(bounds: Box): Array<[number, number]> {
    const corners = Box.corners(bounds);
    const cellMap = new Map<number, Set<number>>();

    for (const corner of corners) {
      const [row, col] = this.pointToCell(corner);
      if (row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE) {
        if (!cellMap.has(row)) {
          cellMap.set(row, new Set());
        }
        cellMap.get(row)!.add(col);
      }
    }

    const center = Box.center(bounds);
    const [centerRow, centerCol] = this.pointToCell(center);
    if (centerRow >= 0 && centerRow < GRID_SIZE && centerCol >= 0 && centerCol < GRID_SIZE) {
      if (!cellMap.has(centerRow)) {
        cellMap.set(centerRow, new Set());
      }
      cellMap.get(centerRow)!.add(centerCol);
    }

    const result: Array<[number, number]> = [];
    for (const [row, cols] of cellMap) {
      for (const col of cols) {
        result.push([row, col]);
      }
    }
    return result;
  }

  private pointToCell(point: Point): [number, number] {
    const relativeX = point.x - this.#diagram.bounds.x;
    const relativeY = point.y - this.#diagram.bounds.y;

    const col = Math.floor((relativeX / this.#diagram.bounds.w) * GRID_SIZE);
    const row = Math.floor((relativeY / this.#diagram.bounds.h) * GRID_SIZE);

    return [Math.max(0, Math.min(GRID_SIZE - 1, row)), Math.max(0, Math.min(GRID_SIZE - 1, col))];
  }

  private distanceToElement(point: Point, element: DiagramElement): number {
    const elementBounds = getElementBounds(element);
    const center = Box.center(elementBounds);
    return Point.squareDistance(point, center);
  }
}
