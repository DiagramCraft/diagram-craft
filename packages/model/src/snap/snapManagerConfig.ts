import { MagnetType } from './magnet';
import { EventEmitter } from '@diagram-craft/utils/event';

/**
 * Configuration properties for the SnapManager
 *
 * These properties control the behavior of the snapping system in the diagram editor.
 * They determine which types of snapping are enabled, how sensitive the snapping is,
 * and whether snapping is active at all.
 */
export interface SnapManagerConfigProps {
  /**
   * Distance threshold in pixels within which snapping will occur
   *
   * When an element being moved comes within this distance of a magnetic line,
   * it will snap to that line. Smaller values require more precise positioning
   * before snapping occurs, while larger values make snapping more "sticky".
   *
   * Typical values:
   * - 3-5px: Precise snapping requiring careful positioning
   * - 5-10px: Moderate snapping for general use
   * - 10-15px: Aggressive snapping for rapid layout
   */
  threshold: number;

  /**
   * Whether snapping is enabled globally
   *
   * When false, no snapping will occur regardless of other settings.
   * When true, snapping behavior is determined by the magnetTypes array
   * and individual snap provider logic.
   */
  enabled: boolean;

  /**
   * Array of magnet types that are currently active
   *
   * Each magnet type corresponds to a different snapping behavior:
   * - 'canvas': Snap to canvas boundaries and viewport edges
   * - 'grid': Snap to grid lines (when grid is visible/enabled)
   * - 'guide': Snap to user-defined guide lines
   * - 'node': Snap to edges and centers of existing nodes
   * - 'distance': Snap to maintain equal distances between nodes
   * - 'size': Snap to match dimensions of existing nodes
   *
   * Only magnet types included in this array will be active during snapping operations.
   */
  magnetTypes: ReadonlyArray<MagnetType>;
}

/**
 * Configuration manager for the diagram snapping system
 *
 * This class manages the settings that control how elements snap to various targets
 * during move and resize operations. It extends EventEmitter to notify listeners
 * when configuration changes occur.
 */
export class SnapManagerConfig
  extends EventEmitter<{
    change: { after: SnapManagerConfigProps };
  }>
  implements SnapManagerConfigProps
{
  magnetTypes: ReadonlyArray<MagnetType> = [];
  enabled: boolean = true;
  threshold: number = 5;

  /**
   * Creates a new snap manager configuration
   *
   * @param magnetTypes - Array of magnet types to enable by default.
   */
  constructor(magnetTypes: ReadonlyArray<MagnetType>) {
    super();

    this.magnetTypes = magnetTypes;
    this.threshold = 5; // Default 5px threshold provides good balance of precision and usability
  }

  commit(): void {
    this.emit('change', { after: this });
  }
}
