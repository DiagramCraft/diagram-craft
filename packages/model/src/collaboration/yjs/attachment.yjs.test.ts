import { describe, expect, it } from 'vitest';
import { createSyncedYJSCRDTs, setupYJS } from './yjsTest';
import { AttachmentManager } from '../../attachment';
import { TestModel } from '../../test-support/builder';

const createBlob = (data: string, type: string = 'text/plain') => {
  return new Blob([data], { type });
};

describe('AttachmentManager', () => {
  setupYJS();

  it('should add a new attachment', async () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const manager1 = new AttachmentManager(doc1, TestModel.newDocument());
    const manager2 = new AttachmentManager(doc2, TestModel.newDocument());

    await manager1.addAttachment(createBlob('new attachment'));

    expect(manager1.attachments.length).toBe(1);
    expect(manager2.attachments.length).toBe(1);
  });

  it('should retrieve an attachment by hash', async () => {
    const { doc1, doc2 } = createSyncedYJSCRDTs();

    const manager1 = new AttachmentManager(doc1, TestModel.newDocument());
    const manager2 = new AttachmentManager(doc2, TestModel.newDocument());

    const attachment = await manager1.addAttachment(createBlob('retrieve attachment'));

    const retrievedAttachment1 = manager1.getAttachment(attachment.hash)!;
    const retrievedAttachment2 = manager2.getAttachment(attachment.hash)!;

    expect(await retrievedAttachment1.content.text()).toBe('retrieve attachment');
    expect(await retrievedAttachment2.content.text()).toBe('retrieve attachment');
  });
});
