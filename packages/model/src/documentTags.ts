import { CRDTRoot, CRDTMap } from './collaboration/crdt';
import { EventEmitter } from '@diagram-craft/utils/event';
import type { EmptyObject } from '@diagram-craft/utils/types';

export type DocumentTagsEvents = {
  update: EmptyObject;
  selectionUpdate: EmptyObject;
};

/**
 * Manages a set of tags for the document using CRDT for collaboration
 */
export class DocumentTags extends EventEmitter<DocumentTagsEvents> {
  #tags: CRDTMap<Record<string, boolean>>;
  #selectedTags: Set<string> = new Set();

  constructor(root: CRDTRoot) {
    super();
    this.#tags = root.getMap('tags');
  }

  get tags(): readonly string[] {
    return Array.from(this.#tags.keys()).sort();
  }

  get selectedTags(): readonly string[] {
    return Array.from(this.#selectedTags).sort();
  }

  add(tag: string): void {
    const trimmedTag = tag.trim();
    if (trimmedTag) {
      this.#tags.set(trimmedTag, true);
      this.emit('update', {});
    }
  }

  remove(tag: string): void {
    this.#tags.delete(tag);
    
    // Clean up selection if the removed tag was selected
    if (this.#selectedTags.has(tag)) {
      this.#selectedTags.delete(tag);
      this.emit('selectionUpdate', {});
    }
    
    this.emit('update', {});
  }

  set(tags: readonly string[]): void {
    const newTags = new Set(tags.map(t => t.trim()).filter(t => t));
    let selectionChanged = false;

    // Remove tags that are no longer in the new set
    for (const existingTag of this.#tags.keys()) {
      if (!newTags.has(existingTag)) {
        this.#tags.delete(existingTag);
        // Clean up selection if the removed tag was selected
        if (this.#selectedTags.has(existingTag)) {
          this.#selectedTags.delete(existingTag);
          selectionChanged = true;
        }
      }
    }

    // Add new tags
    for (const tag of newTags) {
      this.#tags.set(tag, true);
    }

    if (selectionChanged) {
      this.emit('selectionUpdate', {});
    }
    this.emit('update', {});
  }

  has(tag: string): boolean {
    return this.#tags.has(tag);
  }

  clear(): void {
    this.#tags.clear();
    
    // Clear all selections since no tags exist
    if (this.#selectedTags.size > 0) {
      this.#selectedTags.clear();
      this.emit('selectionUpdate', {});
    }
    
    this.emit('update', {});
  }

  // Selected tags management (local only, not replicated)
  selectTag(tag: string): void {
    if (this.has(tag) && !this.#selectedTags.has(tag)) {
      this.#selectedTags.add(tag);
      this.emit('selectionUpdate', {});
    }
  }

  deselectTag(tag: string): void {
    if (this.#selectedTags.has(tag)) {
      this.#selectedTags.delete(tag);
      this.emit('selectionUpdate', {});
    }
  }

  toggleTagSelection(tag: string): void {
    if (this.#selectedTags.has(tag)) {
      this.deselectTag(tag);
    } else {
      this.selectTag(tag);
    }
  }

  isTagSelected(tag: string): boolean {
    return this.#selectedTags.has(tag);
  }

  setSelectedTags(tags: readonly string[]): void {
    const newSelectedTags = new Set(tags.filter(tag => this.has(tag)));
    
    // Check if selection actually changed
    if (newSelectedTags.size !== this.#selectedTags.size || 
        !Array.from(newSelectedTags).every(tag => this.#selectedTags.has(tag))) {
      this.#selectedTags = newSelectedTags;
      this.emit('selectionUpdate', {});
    }
  }

  clearSelectedTags(): void {
    if (this.#selectedTags.size > 0) {
      this.#selectedTags.clear();
      this.emit('selectionUpdate', {});
    }
  }
}