import { describe, expect, it } from 'vitest';
import { Attachment, AttachmentManager } from './attachment';
import { TestModel } from './test-support/builder';
import { Backends, standardTestModel } from './collaboration/collaborationTestUtils';

const createBlob = (data: string, type: string = 'text/plain') => {
  return new Blob([data], { type });
};

describe('Attachment', () => {
  describe('constructor', () => {
    it('should initialize correctly with given hash and content', () => {
      const blob = createBlob('test content');
      const hash = 'testhash';

      const attachment = new Attachment(hash, blob);

      expect(attachment.hash).toBe(hash);
      expect(attachment.content).toBe(blob);
      expect(attachment.inUse).toBe(true);
      expect(attachment.url).toBeTruthy();
    });
  });

  describe('create', () => {
    it('should create an instance using the static create method', async () => {
      const blob = createBlob('test content');
      const attachment = await Attachment.create(blob);

      expect(attachment.hash).toBeTruthy();
      expect(attachment.content).toBe(blob);
      expect(attachment.inUse).toBe(true);
      expect(attachment.url).toBeTruthy();
    });
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

describe.each(Backends.all())('AttachmentManager [%s]', (_name, backend) => {
  describe('addAttachment', () => {
    it('should add a new attachment', async () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const manager1 = new AttachmentManager(root1, TestModel.newDocument());
      const manager2 = root2 ? new AttachmentManager(root2, TestModel.newDocument()) : undefined;

      // Act
      await manager1.addAttachment(createBlob('new attachment'));

      // Verify
      expect(manager1.attachments.length).toBe(1);
      if (manager2) expect(manager2.attachments.length).toBe(1);
    });
  });

  describe('getAttachment', () => {
    it('should retrieve an attachment by hash', async () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const manager1 = new AttachmentManager(root1, TestModel.newDocument());
      const manager2 = root2 ? new AttachmentManager(root2, TestModel.newDocument()) : undefined;

      // Act
      const attachment = await manager1.addAttachment(createBlob('retrieve attachment'));

      // Verify
      expect(await manager1.getAttachment(attachment.hash)!.content.text()).toBe(
        'retrieve attachment'
      );
      if (manager2)
        expect(await manager2.getAttachment(attachment.hash)!.content.text()).toBe(
          'retrieve attachment'
        );
    });

    it('should return existing attachment if hash matches', async () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const manager1 = new AttachmentManager(root1, TestModel.newDocument());
      const manager2 = root2 ? new AttachmentManager(root2, TestModel.newDocument()) : undefined;

      const blob = createBlob('existing attachment');

      // Act
      const attachment1 = await manager1.addAttachment(blob);
      const attachment2 = await manager1.addAttachment(blob);

      // Verify
      expect(attachment1.hash).toBe(attachment2.hash);
      expect(manager1.attachments.length).toBe(1);
      if (manager2) expect(manager2.attachments.length).toBe(1);
    });
  });

  describe('attachments', () => {
    it('should return all attachments', async () => {
      // Setup
      const { root1, root2 } = standardTestModel(backend);

      const manager1 = new AttachmentManager(root1, TestModel.newDocument());
      const manager2 = root2 ? new AttachmentManager(root2, TestModel.newDocument()) : undefined;

      // Act
      await manager1.addAttachment(createBlob('attachment 1'));
      await manager1.addAttachment(createBlob('attachment 2'));

      // Verify
      const attachments = manager1.attachments;
      expect(attachments.length).toBe(2);
      expect(await attachments[0][1].content.text()).toBe('attachment 1');
      expect(await attachments[1][1].content.text()).toBe('attachment 2');

      if (manager2) {
        const attachments2 = manager2.attachments;
        expect(attachments2.length).toBe(2);
        expect(await attachments2[0][1].content.text()).toBe('attachment 1');
        expect(await attachments2[1][1].content.text()).toBe('attachment 2');
      }
    });
  });

  describe('pruneAttachments', () => {
    it('should mark unused attachments as not in use', async () => {
      // Setup
      const { root1 } = standardTestModel(backend);

      const manager = new AttachmentManager(root1, TestModel.newDocument());
      const attachment = await manager.addAttachment(createBlob('prune attachment'));

      // Act
      manager.pruneAttachments();

      // Verify
      const updatedAttachment = manager.getAttachment(attachment.hash)!;
      expect(updatedAttachment.inUse).toBe(false);
    });
  });
});
