import type { DiagramDocument } from './diagramDocument';
import { hash64 } from '@diagram-craft/utils/hash';
import { blobToDataURL } from '@diagram-craft/utils/blobUtils';
import type { CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { Releasable } from '@diagram-craft/utils/releasable';

/**
 * Represents a binary attachment (image, etc.) in the diagram.
 * Each attachment is content-addressed by its hash.
 */
export class Attachment {
  readonly hash: string;
  readonly content: Blob;
  /** Object URL for browser access to the blob */
  readonly url: string;

  /** Whether this attachment is currently referenced by any diagram element */
  inUse: boolean;

  constructor(hash: string, content: Blob, inUse = true) {
    this.hash = hash;
    this.content = content;
    this.inUse = inUse;

    // Create object URL for browser access
    this.url = URL.createObjectURL(
      new Blob([this.content], {
        type: this.content.type
      })
    );
  }

  /** Creates an attachment with computed hash from content */
  static async create(content: Blob) {
    const hash = hash64(new Uint8Array(await content.arrayBuffer()));
    return new Attachment(hash, content);
  }

  /** Converts the attachment content to a data URL */
  async getDataUrl() {
    return blobToDataURL(this.content);
  }
}

/**
 * An object that can report which attachments it uses.
 * Used for garbage collection of unused attachments.
 */
export interface AttachmentConsumer {
  getAttachmentsInUse(): Array<string>;
}

/** CRDT-serializable representation of an attachment */
type AttachmentCRDT = {
  hash: string;
  content: Uint8Array;
  contentType: string;
  inUse?: boolean;
};

/**
 * Manages attachments for a diagram with CRDT synchronization.
 * Provides deduplication and garbage collection of unused attachments.
 */
export class AttachmentManager implements Releasable {
  #attachments: CRDTMap<Record<string, AttachmentCRDT>>;
  #consumers: Array<AttachmentConsumer> = [];

  public constructor(
    private readonly root: CRDTRoot,
    diagramDocument: DiagramDocument
  ) {
    this.#consumers.push(diagramDocument);
    this.#attachments = root.getMap('attachmentManager');
  }

  release() {}

  /**
   * Adds an attachment to the manager.
   * Returns existing attachment if content hash already exists (deduplication).
   */
  async addAttachment(content: Blob): Promise<Attachment> {
    const attachment = await Attachment.create(content);

    // Deduplicate: return existing if same content already stored
    if (this.#attachments.has(attachment.hash)) {
      return this.getAttachment(attachment.hash)!;
    }

    this.#attachments.set(attachment.hash, {
      hash: attachment.hash,
      inUse: attachment.inUse,
      contentType: content.type,
      content: new Uint8Array(await attachment.content.arrayBuffer())
    });

    return attachment;
  }

  /** Returns all attachments as hash-attachment pairs */
  get attachments(): Array<[string, Attachment]> {
    return Array.from(this.#attachments.entries()).map(([hash, ad]) => [
      hash,
      new Attachment(ad.hash, new Blob([new Uint8Array(ad.content)], { type: ad.contentType }))
    ]);
  }

  /** Retrieves an attachment by its hash */
  getAttachment(hash: string) {
    const ad = this.#attachments.get(hash);
    if (!ad) return undefined;
    return new Attachment(
      ad.hash,
      new Blob([new Uint8Array(ad.content)], { type: ad.contentType }),
      ad.inUse
    );
  }

  /**
   * Marks attachments as in-use or unused based on consumer reports.
   * Used for garbage collection of unreferenced attachments.
   */
  pruneAttachments() {
    // Collect all attachment hashes currently in use
    const used = new Set([...this.#consumers.flatMap(c => c.getAttachmentsInUse())]);

    this.root.transact(() => {
      for (const hash of this.#attachments.keys()) {
        const d = this.#attachments.get(hash);
        d!.inUse = used.has(hash);
        this.#attachments.set(hash, d);
      }
    });
  }
}
