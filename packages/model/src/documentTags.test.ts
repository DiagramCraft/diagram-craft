import { describe, expect, it } from 'vitest';
import { DocumentTags } from './documentTags';
import { Backends } from './collaboration/collaborationTestUtils';

describe.each(Backends.all())('DocumentTags [%s]', (_name, backend) => {
  describe('constructor', () => {
    it('should initialize with empty tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();

      // Act
      const tags = new DocumentTags(root1);

      // Verify
      expect(tags.tags).toHaveLength(0);
      expect(tags.tags).toEqual([]);
    });
  });

  describe('add', () => {
    it('should add a tag', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const tags1 = new DocumentTags(root1);
      const tags2 = root2 ? new DocumentTags(root2) : undefined;

      // Act
      tags1.add('important');

      // Verify
      expect(tags1.tags).toContain('important');
      expect(tags1.tags).toHaveLength(1);
      if (tags2) {
        expect(tags2.tags).toContain('important');
        expect(tags2.tags).toHaveLength(1);
      }
    });

    it('should not add duplicate tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.add('important');
      tags.add('important');

      // Verify
      expect(tags.tags).toHaveLength(1);
      expect(tags.tags).toEqual(['important']);
    });

    it('should trim whitespace from tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.add('  important  ');

      // Verify
      expect(tags.tags).toContain('important');
      expect(tags.tags).not.toContain('  important  ');
    });

    it('should not add empty or whitespace-only tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.add('');
      tags.add('   ');
      tags.add('\t\n');

      // Verify
      expect(tags.tags).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('should remove a tag', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const tags1 = new DocumentTags(root1);
      const tags2 = root2 ? new DocumentTags(root2) : undefined;
      tags1.add('important');

      // Act
      tags1.remove('important');

      // Verify
      expect(tags1.tags).not.toContain('important');
      expect(tags1.tags).toHaveLength(0);
      if (tags2) {
        expect(tags2.tags).not.toContain('important');
        expect(tags2.tags).toHaveLength(0);
      }
    });

    it('should handle removing non-existent tags gracefully', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.remove('nonexistent');

      // Verify
      expect(tags.tags).toHaveLength(0);
    });
  });

  describe('has', () => {
    it('should return true for existing tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);
      tags.add('important');

      // Act & Verify
      expect(tags.has('important')).toBe(true);
    });

    it('should return false for non-existent tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act & Verify
      expect(tags.has('nonexistent')).toBe(false);
    });
  });

  describe('set', () => {
    it('should set all tags, replacing existing ones', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const tags1 = new DocumentTags(root1);
      const tags2 = root2 ? new DocumentTags(root2) : undefined;
      tags1.add('old');

      // Act
      tags1.set(['new1', 'new2', 'new3']);

      // Verify
      expect(tags1.tags).toHaveLength(3);
      expect(tags1.tags).toEqual(['new1', 'new2', 'new3']);
      expect(tags1.tags).not.toContain('old');

      if (tags2) {
        expect(tags2.tags).toHaveLength(3);
        expect(tags2.tags).toEqual(['new1', 'new2', 'new3']);
        expect(tags2.tags).not.toContain('old');
      }
    });

    it('should handle duplicates in input array', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.set(['tag1', 'tag2', 'tag1', 'tag3']);

      // Verify
      expect(tags.tags).toHaveLength(3);
      expect(tags.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should trim whitespace from input tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.set(['  tag1  ', '\ttag2\n', 'tag3']);

      // Verify
      expect(tags.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should filter out empty or whitespace-only tags', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.set(['tag1', '', '  ', 'tag2', '\t\n']);

      // Verify
      expect(tags.tags).toHaveLength(2);
      expect(tags.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('clear', () => {
    it('should remove all tags', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      const tags1 = new DocumentTags(root1);
      const tags2 = root2 ? new DocumentTags(root2) : undefined;
      tags1.add('tag1');
      tags1.add('tag2');

      // Act
      tags1.clear();

      // Verify
      expect(tags1.tags).toHaveLength(0);
      if (tags2) {
        expect(tags2.tags).toHaveLength(0);
      }
    });
  });

  describe('tags getter', () => {
    it('should return tags in alphabetical order', () => {
      // Setup
      const [root1] = backend.syncedDocs();
      const tags = new DocumentTags(root1);

      // Act
      tags.add('zebra');
      tags.add('apple');
      tags.add('banana');

      // Verify
      expect(tags.tags).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('collaboration', () => {
    it('should sync tag operations between multiple instances', () => {
      // Setup
      const [root1, root2] = backend.syncedDocs();
      if (!root2) return; // Skip if backend doesn't support collaboration

      const tags1 = new DocumentTags(root1);
      const tags2 = new DocumentTags(root2);

      // Act - Add tags from both instances
      tags1.add('from-root1');
      tags2.add('from-root2');

      // Verify - Both should see all tags
      expect(tags1.tags).toContain('from-root1');
      expect(tags1.tags).toContain('from-root2');
      expect(tags2.tags).toContain('from-root1');
      expect(tags2.tags).toContain('from-root2');

      // Act - Remove tag from one instance
      tags1.remove('from-root2');

      // Verify - Both should reflect the removal
      expect(tags1.tags).not.toContain('from-root2');
      expect(tags2.tags).not.toContain('from-root2');
      expect(tags1.tags).toContain('from-root1');
      expect(tags2.tags).toContain('from-root1');
    });
  });
});