import { describe, expect, it } from 'vitest';
import { DocumentTags } from './documentTags';
import { Backends } from './test-support/collaborationTestUtils';

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

  describe('selectedTags', () => {
    describe('selectedTags getter', () => {
      it('should initially return empty array', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);

        // Verify
        expect(tags.selectedTags).toHaveLength(0);
        expect(tags.selectedTags).toEqual([]);
      });

      it('should return selected tags in alphabetical order', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('zebra');
        tags.add('apple');
        tags.add('banana');

        // Act
        tags.selectTag('zebra');
        tags.selectTag('apple');

        // Verify
        expect(tags.selectedTags).toEqual(['apple', 'zebra']);
      });
    });

    describe('selectTag', () => {
      it('should select an existing tag', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');

        // Act
        tags.selectTag('important');

        // Verify
        expect(tags.isTagSelected('important')).toBe(true);
        expect(tags.selectedTags).toContain('important');
      });

      it('should not select non-existent tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);

        // Act
        tags.selectTag('nonexistent');

        // Verify
        expect(tags.isTagSelected('nonexistent')).toBe(false);
        expect(tags.selectedTags).not.toContain('nonexistent');
        expect(tags.selectedTags).toHaveLength(0);
      });

      it('should not add duplicate selections', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');

        // Act
        tags.selectTag('important');
        tags.selectTag('important');

        // Verify
        expect(tags.selectedTags).toHaveLength(1);
        expect(tags.selectedTags).toEqual(['important']);
      });

      it('should emit selectionUpdate event when tag is selected', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.selectTag('important');

        // Verify
        expect(eventEmitted).toBe(true);
      });

      it('should not emit selectionUpdate event for non-existent tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.selectTag('nonexistent');

        // Verify
        expect(eventEmitted).toBe(false);
      });

      it('should not emit selectionUpdate event for already selected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        tags.selectTag('important');
        let eventCount = 0;
        tags.on('selectionUpdate', () => {
          eventCount++;
        });

        // Act
        tags.selectTag('important');

        // Verify
        expect(eventCount).toBe(0);
      });
    });

    describe('deselectTag', () => {
      it('should deselect a selected tag', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        tags.selectTag('important');

        // Act
        tags.deselectTag('important');

        // Verify
        expect(tags.isTagSelected('important')).toBe(false);
        expect(tags.selectedTags).not.toContain('important');
        expect(tags.selectedTags).toHaveLength(0);
      });

      it('should handle deselecting non-selected tags gracefully', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');

        // Act
        tags.deselectTag('important');

        // Verify
        expect(tags.selectedTags).toHaveLength(0);
      });

      it('should emit selectionUpdate event when tag is deselected', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        tags.selectTag('important');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.deselectTag('important');

        // Verify
        expect(eventEmitted).toBe(true);
      });

      it('should not emit selectionUpdate event for non-selected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.deselectTag('important');

        // Verify
        expect(eventEmitted).toBe(false);
      });
    });

    describe('toggleTagSelection', () => {
      it('should select an unselected existing tag', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');

        // Act
        tags.toggleTagSelection('important');

        // Verify
        expect(tags.isTagSelected('important')).toBe(true);
      });

      it('should deselect a selected tag', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        tags.selectTag('important');

        // Act
        tags.toggleTagSelection('important');

        // Verify
        expect(tags.isTagSelected('important')).toBe(false);
      });

      it('should not affect non-existent tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);

        // Act
        tags.toggleTagSelection('nonexistent');

        // Verify
        expect(tags.selectedTags).toHaveLength(0);
      });
    });

    describe('isTagSelected', () => {
      it('should return true for selected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');
        tags.selectTag('important');

        // Act & Verify
        expect(tags.isTagSelected('important')).toBe(true);
      });

      it('should return false for unselected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('important');

        // Act & Verify
        expect(tags.isTagSelected('important')).toBe(false);
      });

      it('should return false for non-existent tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);

        // Act & Verify
        expect(tags.isTagSelected('nonexistent')).toBe(false);
      });
    });

    describe('setSelectedTags', () => {
      it('should set all selected tags, replacing existing ones', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.add('tag2');
        tags.add('tag3');
        tags.selectTag('tag1');

        // Act
        tags.setSelectedTags(['tag2', 'tag3']);

        // Verify
        expect(tags.selectedTags).toHaveLength(2);
        expect(tags.selectedTags).toEqual(['tag2', 'tag3']);
        expect(tags.isTagSelected('tag1')).toBe(false);
        expect(tags.isTagSelected('tag2')).toBe(true);
        expect(tags.isTagSelected('tag3')).toBe(true);
      });

      it('should filter out non-existent tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('existing');

        // Act
        tags.setSelectedTags(['existing', 'nonexistent']);

        // Verify
        expect(tags.selectedTags).toHaveLength(1);
        expect(tags.selectedTags).toEqual(['existing']);
      });

      it('should emit selectionUpdate event when selection changes', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.add('tag2');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.setSelectedTags(['tag1', 'tag2']);

        // Verify
        expect(eventEmitted).toBe(true);
      });

      it('should not emit selectionUpdate event when selection is identical', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.add('tag2');
        tags.selectTag('tag1');
        tags.selectTag('tag2');
        let eventCount = 0;
        tags.on('selectionUpdate', () => {
          eventCount++;
        });

        // Act
        tags.setSelectedTags(['tag1', 'tag2']);

        // Verify
        expect(eventCount).toBe(0);
      });

      it('should handle empty selection array', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.selectTag('tag1');

        // Act
        tags.setSelectedTags([]);

        // Verify
        expect(tags.selectedTags).toHaveLength(0);
      });
    });

    describe('clearSelectedTags', () => {
      it('should clear all selected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.add('tag2');
        tags.selectTag('tag1');
        tags.selectTag('tag2');

        // Act
        tags.clearSelectedTags();

        // Verify
        expect(tags.selectedTags).toHaveLength(0);
        expect(tags.isTagSelected('tag1')).toBe(false);
        expect(tags.isTagSelected('tag2')).toBe(false);
      });

      it('should emit selectionUpdate event when there are selected tags to clear', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.selectTag('tag1');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.clearSelectedTags();

        // Verify
        expect(eventEmitted).toBe(true);
      });

      it('should not emit selectionUpdate event when there are no selected tags', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        let eventEmitted = false;
        tags.on('selectionUpdate', () => {
          eventEmitted = true;
        });

        // Act
        tags.clearSelectedTags();

        // Verify
        expect(eventEmitted).toBe(false);
      });
    });

    describe('selectedTags isolation', () => {
      it('should not replicate selectedTags between instances', () => {
        // Setup
        const [root1, root2] = backend.syncedDocs();
        if (!root2) return; // Skip if backend doesn't support collaboration

        const tags1 = new DocumentTags(root1);
        const tags2 = new DocumentTags(root2);
        tags1.add('shared-tag');

        // Act - Select tag in first instance only
        tags1.selectTag('shared-tag');

        // Verify - Only first instance should have selection
        expect(tags1.isTagSelected('shared-tag')).toBe(true);
        expect(tags2.isTagSelected('shared-tag')).toBe(false);
        expect(tags1.selectedTags).toContain('shared-tag');
        expect(tags2.selectedTags).not.toContain('shared-tag');
      });

      it('should maintain separate selections in different instances', () => {
        // Setup
        const [root1, root2] = backend.syncedDocs();
        if (!root2) return; // Skip if backend doesn't support collaboration

        const tags1 = new DocumentTags(root1);
        const tags2 = new DocumentTags(root2);
        tags1.add('tag1');
        tags1.add('tag2');

        // Act - Different selections in each instance
        tags1.selectTag('tag1');
        tags2.selectTag('tag2');

        // Verify - Each instance maintains its own selection
        expect(tags1.isTagSelected('tag1')).toBe(true);
        expect(tags1.isTagSelected('tag2')).toBe(false);
        expect(tags2.isTagSelected('tag1')).toBe(false);
        expect(tags2.isTagSelected('tag2')).toBe(true);
      });
    });

    describe('edge cases with tag operations', () => {
      it('should automatically deselect tags when they are removed', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('temporary');
        tags.selectTag('temporary');

        // Act
        tags.remove('temporary');

        // Verify - Tag should no longer be selected since it doesn't exist
        expect(tags.isTagSelected('temporary')).toBe(false);
        expect(tags.selectedTags).not.toContain('temporary');
      });

      it('should clear selections when all tags are cleared', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('tag1');
        tags.add('tag2');
        tags.selectTag('tag1');
        tags.selectTag('tag2');

        // Act
        tags.clear();

        // Verify - No selections should remain
        expect(tags.selectedTags).toHaveLength(0);
        expect(tags.isTagSelected('tag1')).toBe(false);
        expect(tags.isTagSelected('tag2')).toBe(false);
      });

      it('should maintain valid selections when tags are replaced with set()', () => {
        // Setup
        const [root1] = backend.syncedDocs();
        const tags = new DocumentTags(root1);
        tags.add('old1');
        tags.add('old2');
        tags.selectTag('old1');
        tags.selectTag('old2');

        // Act
        tags.set(['new1', 'old2', 'new2']);

        // Verify - Only selections for remaining tags should persist
        expect(tags.isTagSelected('old1')).toBe(false); // removed tag
        expect(tags.isTagSelected('old2')).toBe(true); // kept tag
        expect(tags.isTagSelected('new1')).toBe(false); // new tag, not selected
        expect(tags.selectedTags).toEqual(['old2']);
      });
    });
  });
});
