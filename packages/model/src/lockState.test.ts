import { describe, expect, it } from 'vitest';
import { TestModel } from './test-support/testModel';
import { UnitOfWork } from './unitOfWork';

describe('lock state', () => {
  it('separates local and effective lock state across the hierarchy', () => {
    const { diagram, layer } = TestModel.newDiagramWithLayer();
    const node = layer.addNode({ id: 'node-1' });
    const document = diagram.document;

    expect(document.locked).toBe(false);
    expect(document.isEffectivelyLocked()).toBe(false);
    expect(diagram.locked).toBe(false);
    expect(diagram.isEffectivelyLocked()).toBe(false);
    expect(layer.locked).toBe(false);
    expect(layer.isEffectivelyLocked()).toBe(false);
    expect(node.locked).toBe(false);
    expect(node.isEffectivelyLocked()).toBe(false);

    UnitOfWork.executeSilently(undefined, uow => document.setLocked(true, uow));

    expect(document.locked).toBe(true);
    expect(document.isEffectivelyLocked()).toBe(true);
    expect(diagram.locked).toBe(false);
    expect(diagram.isEffectivelyLocked()).toBe(true);
    expect(layer.locked).toBe(false);
    expect(layer.isEffectivelyLocked()).toBe(true);
    expect(node.locked).toBe(false);
    expect(node.isEffectivelyLocked()).toBe(true);

    UnitOfWork.executeSilently(undefined, uow => document.setLocked(false, uow));
    UnitOfWork.execute(diagram, uow => diagram.setLocked(true, uow));

    expect(document.isEffectivelyLocked()).toBe(false);
    expect(diagram.locked).toBe(true);
    expect(diagram.isEffectivelyLocked()).toBe(true);
    expect(layer.isEffectivelyLocked()).toBe(true);
    expect(node.isEffectivelyLocked()).toBe(true);

    UnitOfWork.execute(diagram, uow => diagram.setLocked(false, uow));
    UnitOfWork.execute(diagram, uow => layer.setLocked(true, uow));

    expect(layer.locked).toBe(true);
    expect(layer.isEffectivelyLocked()).toBe(true);
    expect(node.locked).toBe(false);
    expect(node.isEffectivelyLocked()).toBe(true);

    UnitOfWork.execute(diagram, uow => node.setLocked(true, uow));

    expect(node.locked).toBe(true);
    expect(node.isEffectivelyLocked()).toBe(true);
  });
});
