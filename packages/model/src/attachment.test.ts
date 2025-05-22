import { describe, expect, it } from 'vitest';
import { Attachment, AttachmentManager } from './attachment';
import { NoOpCRDTRoot } from './collaboration/noopCrdt';
import { TestModel } from './test-support/builder';

const createBlob = (data: string, type: string = 'text/plain') => {
  return new Blob([data], { type });
};

describe('Attachment', () => {
  it('should initialize correctly with given hash and content', () => {
    const blob = createBlob('test content');
    const hash = 'testhash';

    const attachment = new Attachment(hash, blob);

    expect(attachment.hash).toBe(hash);
    expect(attachment.content).toBe(blob);
    expect(attachment.inUse).toBe(true);
    expect(attachment.url).toBeTruthy();
  });

  it('should create an instance using the static create method', async () => {
    const blob = createBlob('test content');
    const attachment = await Attachment.create(blob);

    expect(attachment.hash).toBeTruthy();
    expect(attachment.content).toBe(blob);
    expect(attachment.inUse).toBe(true);
    expect(attachment.url).toBeTruthy();
  });

  // TODO: See if this can be made to work
  /*
  it('should return a valid data URL from getDataUrl', async () => {
    const blob = createBlob('test content');
    const attachment = new Attachment('testhash', blob);

    const dataUrl = await attachment.getDataUrl();
    expect(dataUrl).toContain('data:text/plain;base64,');
  });
  */
});

describe('AttachmentManager', () => {
  it('should add a new attachment', async () => {
    const manager = new AttachmentManager(new NoOpCRDTRoot(), TestModel.newDocument());
    await manager.addAttachment(createBlob('new attachment'));

    expect(manager.attachments.length).toBe(1);
  });

  it('should return existing attachment if hash matches', async () => {
    const manager = new AttachmentManager(new NoOpCRDTRoot(), TestModel.newDocument());
    const blob = createBlob('existing attachment');
    const attachment1 = await manager.addAttachment(blob);
    const attachment2 = await manager.addAttachment(blob);

    expect(attachment1.hash).toBe(attachment2.hash);
    expect(manager.attachments.length).toBe(1);
  });

  it('should return all attachments', async () => {
    const manager = new AttachmentManager(new NoOpCRDTRoot(), TestModel.newDocument());
    await manager.addAttachment(createBlob('attachment 1'));
    await manager.addAttachment(createBlob('attachment 2'));

    const attachments = manager.attachments;

    expect(attachments.length).toBe(2);
    expect(await attachments[0][1].content.text()).toBe('attachment 1');
    expect(await attachments[1][1].content.text()).toBe('attachment 2');
  });

  it('should retrieve an attachment by hash', async () => {
    const manager = new AttachmentManager(new NoOpCRDTRoot(), TestModel.newDocument());
    const attachment = await manager.addAttachment(createBlob('retrieve attachment'));

    const retrievedAttachment = manager.getAttachment(attachment.hash)!;

    expect(await retrievedAttachment.content.text()).toBe('retrieve attachment');
  });

  // TODO: Enable this - doesn't work in GitHub Actions
  /*
  it('should mark unused attachments as not in use', async () => {
    const manager = new AttachmentManager(new NoOpCRDTRoot(), TestModel.newDocument());
    const attachment = await manager.addAttachment(createBlob('prune attachment'));

    manager.pruneAttachments();

    const updatedAttachment = manager.getAttachment(attachment.hash);
    expect(updatedAttachment.inUse).toBe(false);
  });
   */
});
