import { describe, expect, test } from 'vitest';
import { ActionContext } from '@diagram-craft/canvas/action';
import {
  DEFAULT_SNAP_CONFIG,
  getSnapConfig
} from '@diagram-craft/canvas/snap/snapManager';
import { $tStr } from '@diagram-craft/utils/localize';
import { TestModel } from '@diagram-craft/model/test-support/testModel';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { Diagram } from '@diagram-craft/model/diagram';
import { ToggleMagnetTypeAction } from './toggleMagnetTypeAction';

const mkContext = (diagram: Diagram): ActionContext =>
  ({
    model: {
      activeDiagram: diagram,
      // biome-ignore lint/suspicious/noExplicitAny: false positive
      on: (_a: any, _b: any, _c: any) => {}
    }
  }) as ActionContext;

describe('ToggleMagnetTypeAction', () => {
  test('should not mutate shared snap defaults or other diagrams', () => {
    const firstDiagram = TestModel.newDiagram();
    const secondDiagram = TestModel.newDiagram();

    const action = new ToggleMagnetTypeAction(
      'grid',
      $tStr('action.TOGGLE_MAGNET_TYPE_GRID.name', 'Toggle Grid Magnet'),
      mkContext(firstDiagram)
    );

    action.execute();

    expect(getSnapConfig(firstDiagram).magnetTypes.grid).toBe(false);
    expect(getSnapConfig(secondDiagram).magnetTypes.grid).toBe(true);
    expect(DEFAULT_SNAP_CONFIG.magnetTypes.grid).toBe(true);
  });

  test('should support undo and redo', () => {
    const diagram = TestModel.newDiagram();
    const action = new ToggleMagnetTypeAction(
      'distance',
      $tStr('action.TOGGLE_MAGNET_TYPE_DISTANCE.name', 'Toggle Distance Magnet'),
      mkContext(diagram)
    );

    expect(action.getState(undefined)).toBe(true);

    action.execute();
    expect(getSnapConfig(diagram).magnetTypes.distance).toBe(false);
    expect(action.getState(undefined)).toBe(false);

    diagram.undoManager.undo();
    expect(getSnapConfig(diagram).magnetTypes.distance).toBe(true);
    expect(action.getState(undefined)).toBe(true);

    diagram.undoManager.redo();
    expect(getSnapConfig(diagram).magnetTypes.distance).toBe(false);
    expect(action.getState(undefined)).toBe(false);
  });

  test('should normalize partial snap config before toggling', () => {
    const diagram = TestModel.newDiagram();

    UnitOfWork.executeSilently(diagram, uow =>
      diagram.updateProps(props => {
        props.snap = {
          enabled: false,
          magnetTypes: { grid: false }
        } as NonNullable<typeof props.snap>;
      }, uow)
    );

    const action = new ToggleMagnetTypeAction(
      'node',
      $tStr('action.TOGGLE_MAGNET_TYPE_NODE.name', 'Toggle Node Magnet'),
      mkContext(diagram)
    );

    const snapConfig = getSnapConfig(diagram);

    expect(snapConfig.enabled).toBe(false);
    expect(snapConfig.threshold).toBe(DEFAULT_SNAP_CONFIG.threshold);
    expect(snapConfig.magnetTypes.grid).toBe(false);
    expect(snapConfig.magnetTypes.node).toBe(true);
    expect(action.getState(undefined)).toBe(true);
  });
});
