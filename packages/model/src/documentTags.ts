import { CRDTRoot, CRDTMap } from './collaboration/crdt';

/**
 * Manages a set of tags for the document using CRDT for collaboration
 */
export class DocumentTags {
  #tags: CRDTMap<Record<string, boolean>>;

  constructor(root: CRDTRoot) {
    this.#tags = root.getMap('tags');
  }

  get tags(): readonly string[] {
    return Array.from(this.#tags.keys()).sort();
  }

  add(tag: string): void {
    const trimmedTag = tag.trim();
    if (trimmedTag) {
      this.#tags.set(trimmedTag, true);
    }
  }

  remove(tag: string): void {
    this.#tags.delete(tag);
  }

  set(tags: readonly string[]): void {
    const newTags = new Set(tags.map(t => t.trim()).filter(t => t));

    // Remove tags that are no longer in the new set
    for (const existingTag of this.#tags.keys()) {
      if (!newTags.has(existingTag)) {
        this.#tags.delete(existingTag);
      }
    }

    // Add new tags
    for (const tag of newTags) {
      this.#tags.set(tag, true);
    }
  }

  has(tag: string): boolean {
    return this.#tags.has(tag);
  }

  clear(): void {
    this.#tags.clear();
  }
}