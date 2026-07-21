import { describe, expect, it } from 'vitest';
import { Backends } from '@diagram-craft/collaboration/test-support/collaborationTestUtils';
import { standardTestModel } from './test-support/collaborationModelTestUtils';
import { UnitOfWork } from './unitOfWork';
import { RegularLayer } from './diagramLayerRegular';

describe.each(Backends.all())('lock state CRDT sync [%s]', (_name, backend) => {
  it('syncs document lock live to a remote collaborator', () => {
    const { doc1, doc2 } = standardTestModel(backend);
    if (!doc2) return;

    expect(doc2.locked).toBe(false);

    UnitOfWork.executeSilently(undefined, uow => doc1.setLocked(true, uow));

    expect(doc2.locked).toBe(true);
  });

  it('syncs diagram lock live to a remote collaborator', () => {
    const { diagram1, diagram2 } = standardTestModel(backend);
    if (!diagram2) return;

    expect(diagram2.locked).toBe(false);

    UnitOfWork.execute(diagram1, uow => diagram1.setLocked(true, uow));

    expect(diagram2.locked).toBe(true);
  });

  it('syncs layer lock live to a remote collaborator', () => {
    const { diagram1, layer1, layer2 } = standardTestModel(backend);
    if (!layer2) return;

    expect(layer2.locked).toBe(false);

    UnitOfWork.execute(diagram1, uow => layer1.setLocked(true, uow));

    expect(layer2.locked).toBe(true);
  });

  it('syncs element lock live to a remote collaborator', () => {
    const { diagram1, diagram2, layer1 } = standardTestModel(backend);
    if (!diagram2) return;

    const node1 = layer1.addNode({ id: 'node-1' });

    const layer2 = diagram2.layers.byId(layer1.id) as RegularLayer;
    const node2 = layer2.elements.find(e => e.id === 'node-1')!;

    expect(node2.locked).toBe(false);

    UnitOfWork.execute(diagram1, uow => node1.setLocked(true, uow));

    expect(node2.locked).toBe(true);
  });
});
