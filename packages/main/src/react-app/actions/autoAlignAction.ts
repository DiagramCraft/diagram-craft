import {
  AbstractSelectionAction,
  ElementType,
  MultipleType
} from '@diagram-craft/canvas-app/actions/abstractSelectionAction';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import type { DiagramNode } from '@diagram-craft/model/diagramNode';
import type { Application } from '../../application';
import { Magnet, type MagnetType } from '@diagram-craft/canvas/snap/magnet';
import { Box, WritableBox } from '@diagram-craft/geometry/box';
import { Axis } from '@diagram-craft/geometry/axis';
import type { Diagram } from '@diagram-craft/model/diagram';
import { GridSnapProvider } from '@diagram-craft/canvas/snap/gridSnapProvider';
import { NodeSnapProvider } from '@diagram-craft/canvas/snap/nodeSnapProvider';
import { GuidesSnapProvider } from '@diagram-craft/canvas/snap/guidesSnapProvider';
import { CanvasSnapProvider } from '@diagram-craft/canvas/snap/canvasSnapProvider';
import { NodeDistanceSnapProvider } from '@diagram-craft/canvas/snap/nodeDistanceSnapProvider';
import { NodeSizeSnapProvider } from '@diagram-craft/canvas/snap/nodeSizeSnapProvider';
import type { SnapProvider } from '@diagram-craft/canvas/snap/snapManager';

declare global {
  namespace DiagramCraft {
    interface ActionMapExtensions extends ReturnType<typeof autoAlignActions> {}
  }
}

export type AutoAlignConfig = {
  threshold: number;
  magnetTypes: {
    canvas: boolean;
    grid: boolean;
    guide: boolean;
    node: boolean;
    distance: boolean;
    size: boolean;
  };
  mode: 'move' | 'resize' | 'both' | 'none';
};

type MatchingMagnetPair = {
  self: Magnet;
  matching: Magnet;
  distance: number;
};

export const autoAlignActions = (context: Application) => ({
  AUTO_ALIGN: new AutoAlignAction(context)
});

export class AutoAlignAction extends AbstractSelectionAction<Application> {
  constructor(context: Application) {
    super(context, MultipleType.Both, ElementType.Node);
  }

  execute(): void {
    const undoManager = this.context.model.activeDiagram.undoManager;
    undoManager.setMark();

    this.context.ui.showDialog({
      id: 'toolAutoAlign',
      props: {
        onChange: (config: AutoAlignConfig) => {
          undoManager.undoToMark();
          this.applyAutoAlign(config);
        }
      },
      onCancel: () => {
        undoManager.undoToMark();
        undoManager.clearRedo();
      },
      onOk: (config: AutoAlignConfig) => {
        undoManager.undoToMark();
        this.applyAutoAlign(config);
        this.emit('actionTriggered', {});
      }
    });
  }

  private applyAutoAlign(config: AutoAlignConfig): void {
    const diagram = this.context.model.activeDiagram;
    const uow = new UnitOfWork(diagram, true);

    // If mode is 'none', do nothing
    if (config.mode === 'none') return;

    // 1. Filter to movable, non-label nodes (these will be moved/resized)
    const nodesToAlign = this.getAlignableNodes();
    if (nodesToAlign.length === 0) return;

    // 2. Create magnets from NON-SELECTED elements only
    // Selected nodes will be added to dynamic magnets as they align
    const selectedNodeIds = new Set(nodesToAlign.map(n => n.id));
    const eligibleNodePredicate = (id: string) => !selectedNodeIds.has(id);
    const enabledMagnetTypes = this.getEnabledMagnetTypes(config.magnetTypes);
    const fixedMagnets = this.getFixedMagnets(diagram, enabledMagnetTypes, eligibleNodePredicate);

    // 3. Sort nodes by area (smallest first)
    const sortedNodes = this.sortByArea(nodesToAlign);

    // 4. Run alignment iterations (max 3 passes)
    const MAX_ITERATIONS = 3;

    if (config.mode === 'both') {
      // When both resize and move are selected, run in phases:
      // Phase 1: Resize iterations
      // Phase 2: Move iterations
      // This prevents conflicts between resize and move operations

      // Phase 1: Resize
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const changeCount = this.alignIteration(
          sortedNodes,
          fixedMagnets,
          config.threshold,
          'resize',
          uow
        );
        if (changeCount === 0) break; // Stable state reached
      }

      // Phase 2: Move
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const changeCount = this.alignIteration(
          sortedNodes,
          fixedMagnets,
          config.threshold,
          'move',
          uow
        );
        if (changeCount === 0) break; // Stable state reached
      }
    } else {
      // Single mode: run iterations with the specified mode
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const changeCount = this.alignIteration(
          sortedNodes,
          fixedMagnets,
          config.threshold,
          config.mode,
          uow
        );
        if (changeCount === 0) break; // Stable state reached
      }
    }

    // 5. Commit changes
    commitWithUndo(uow, 'Auto-align elements');
  }

  private getAlignableNodes(): DiagramNode[] {
    const selection = this.context.model.activeDiagram.selection;

    return selection.nodes.filter(node => {
      // Skip if not movable
      if (node.renderProps.capabilities.movable === false) {
        return false;
      }

      // Skip label nodes (they're attached to edges)
      return !node.isLabelNode();
    });
  }

  private sortByArea(nodes: DiagramNode[]): DiagramNode[] {
    return nodes.toSorted((a, b) => {
      const areaA = Math.abs(a.bounds.w * a.bounds.h);
      const areaB = Math.abs(b.bounds.w * b.bounds.h);
      return areaA - areaB; // Smallest first
    });
  }

  private getEnabledMagnetTypes(magnetConfig: Record<string, boolean>): MagnetType[] {
    return Object.entries(magnetConfig)
      .filter(([_, enabled]) => enabled)
      .map(([type]) => type as MagnetType);
  }

  private getFixedMagnets(
    diagram: Diagram,
    magnetTypes: MagnetType[],
    eligibleNodePredicate: (id: string) => boolean
  ): ReadonlyArray<Magnet> {
    const viewportBox = { ...diagram.bounds, r: 0 };
    const magnets: Magnet[] = [];

    for (const type of magnetTypes) {
      // biome-ignore lint/suspicious/noExplicitAny: correct
      let provider: SnapProvider<any>;
      switch (type) {
        case 'grid':
          provider = new GridSnapProvider(diagram);
          break;
        case 'node':
          provider = new NodeSnapProvider(diagram, eligibleNodePredicate);
          break;
        case 'guide':
          provider = new GuidesSnapProvider(diagram);
          break;
        case 'canvas':
          provider = new CanvasSnapProvider(diagram);
          break;
        case 'distance':
          provider = new NodeDistanceSnapProvider(diagram, eligibleNodePredicate);
          break;
        case 'size':
          provider = new NodeSizeSnapProvider(diagram, eligibleNodePredicate);
          break;
        default:
          continue;
      }
      magnets.push(...provider.getMagnets(viewportBox));
    }

    return magnets;
  }

  private alignIteration(
    sortedNodes: DiagramNode[],
    fixedMagnets: ReadonlyArray<Magnet>,
    threshold: number,
    mode: 'move' | 'resize' | 'both',
    uow: UnitOfWork
  ): number {
    let movedCount = 0;
    const dynamicMagnets: Magnet[] = [];

    for (const node of sortedNodes) {
      // Create source magnets for this node
      const sourceMagnets = Magnet.forNode(node.bounds);

      // Combine fixed + dynamic magnets, but exclude the current node's own magnets
      // to prevent self-matching
      const allTargetMagnets = [...fixedMagnets, ...dynamicMagnets].filter(m => {
        // Filter out node magnets that belong to the current node
        if (m.type === 'node') {
          return m.node.id !== node.id;
        }
        // Also filter out size magnets from current node
        if (m.type === 'size') {
          return m.node.id !== node.id;
        }
        return true;
      });

      // Find alignments within threshold
      const matches = this.matchMagnets(sourceMagnets, allTargetMagnets, threshold);

      if (matches.length === 0) {
        // No alignment found, add to dynamic pool
        dynamicMagnets.push(...Magnet.forNode(node.bounds));
        continue;
      }

      // Calculate new position/size (closest match per axis)
      const newBounds = this.calculateAlignedBounds(node.bounds, matches, mode);

      // Update if position or size changed
      if (!Box.isEqual(node.bounds, newBounds)) {
        uow.snapshot(node);
        node.setBounds(newBounds, uow);
        movedCount++;
        dynamicMagnets.push(...Magnet.forNode(newBounds));
      } else {
        dynamicMagnets.push(...Magnet.forNode(node.bounds));
      }
    }

    return movedCount;
  }

  private matchMagnets(
    sourceMagnets: ReadonlyArray<Magnet>,
    targetMagnets: ReadonlyArray<Magnet>,
    threshold: number
  ): MatchingMagnetPair[] {
    const matches: MatchingMagnetPair[] = [];

    for (const target of targetMagnets) {
      for (const source of sourceMagnets) {
        // Must be same axis (both horizontal or both vertical)
        if (target.axis !== source.axis) continue;

        // Respect direction if specified
        if (target.respectDirection && target.matchDirection !== source.matchDirection) {
          continue;
        }

        // Calculate orthogonal distance
        const axis = Axis.toXY(Axis.orthogonal(source.axis));
        const distance = source.line.from[axis] - target.line.from[axis];

        if (Math.abs(distance) <= threshold) {
          matches.push({ self: source, matching: target, distance });
        }
      }
    }

    return matches;
  }

  private calculateAlignedBounds(
    originalBounds: Box,
    matchingMagnets: MatchingMagnetPair[],
    mode: 'move' | 'resize' | 'both' | 'none'
  ): Box {
    // If mode is 'none', return original bounds unchanged
    if (mode === 'none') return originalBounds;

    const newBounds = Box.asReadWrite(originalBounds);

    if (mode === 'move') {
      // MOVE MODE: Check left/center/right, then top/center/bottom
      // Find the closest match for each axis and move the whole element

      // Horizontal axis (left/center/right)
      const hMatches = matchingMagnets.filter(m => m.self.axis === Axis.v);
      if (hMatches.length > 0) {
        // Find closest match across all horizontal magnets (left/center/right)
        let closestMatch: MatchingMagnetPair | null = null;
        for (const match of hMatches) {
          if (!closestMatch || Math.abs(match.distance) < Math.abs(closestMatch.distance)) {
            closestMatch = match;
          }
        }
        if (closestMatch) {
          newBounds.x -= closestMatch.distance;
        }
      }

      // Vertical axis (top/center/bottom)
      const vMatches = matchingMagnets.filter(m => m.self.axis === Axis.h);
      if (vMatches.length > 0) {
        // Find closest match across all vertical magnets (top/center/bottom)
        let closestMatch: MatchingMagnetPair | null = null;
        for (const match of vMatches) {
          if (!closestMatch || Math.abs(match.distance) < Math.abs(closestMatch.distance)) {
            closestMatch = match;
          }
        }
        if (closestMatch) {
          newBounds.y -= closestMatch.distance;
        }
      }
    } else if (mode === 'resize') {
      // RESIZE MODE: Check each edge in order (left, top, right, bottom)
      // Resize the element to align the FIRST edge found within threshold

      // Find matches for each edge
      const edgeMatches = new Map<string, MatchingMagnetPair>();
      for (const match of matchingMagnets) {
        const sourceMagnet = match.self as any;
        const direction = sourceMagnet.matchDirection;
        if (direction) {
          const existing = edgeMatches.get(direction);
          if (!existing || Math.abs(match.distance) < Math.abs(existing.distance)) {
            edgeMatches.set(direction, match);
          }
        }
      }

      // Process edges in order: left, top, right, bottom
      // Apply only the FIRST matching edge found
      const edgeOrder = ['w', 'n', 'e', 's'];
      for (const direction of edgeOrder) {
        const match = edgeMatches.get(direction);
        if (!match) continue;

        const distance = match.distance;

        switch (direction) {
          case 'w': // Left edge
            newBounds.x -= distance;
            newBounds.w += distance;
            break;
          case 'n': // Top edge
            newBounds.y -= distance;
            newBounds.h += distance;
            break;
          case 'e': // Right edge
            newBounds.w -= distance;
            break;
          case 's': // Bottom edge
            newBounds.h -= distance;
            break;
        }
      }
    }

    return WritableBox.asBox(newBounds);
  }
}
