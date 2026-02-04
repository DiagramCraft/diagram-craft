/**
 * Attachment management system for handling binary resources in diagrams.
 *
 * This module provides functionality for storing, retrieving, and managing binary
 * attachments (images, files, etc.) within diagram documents. It implements content-
 * addressed storage with automatic deduplication and garbage collection.
 *
 * @module attachment
 *
 * @remarks
 * ## Key Concepts
 *
 * **Content-Addressed Storage**: Each attachment is identified by a hash of its content.
 * Identical content is stored only once, regardless of how many diagram elements reference
 * it. This ensures efficient storage and eliminates data duplication.
 *
 * **Object URLs**: Attachments are stored as Blobs and exposed via object URLs for browser
 * access. This allows direct use in `<img>` tags and other DOM elements without Base64
 * encoding overhead.
 *
 * **Reference Tracking**: The system tracks which attachments are actively used by diagram
 * elements through the {@link AttachmentConsumer} interface. This enables automatic garbage
 * collection of unreferenced attachments.
 *
 * ## Architecture
 *
 * The module consists of three main components:
 *
 * 1. **{@link Attachment}**: Represents a single binary attachment with its hash, content,
 *    and browser-accessible URL. Immutable once created.
 *
 * 2. **{@link AttachmentConsumer}**: Interface implemented by diagram elements that use
 *    attachments. Enables reference tracking for garbage collection.
 *
 * 3. **{@link AttachmentManager}**: Central manager for all attachments in a diagram.
 *    Handles adding, retrieving, deduplication, and garbage collection.
 *
 * ## Garbage Collection
 *
 * The attachment system supports automatic cleanup of unused attachments:
 * - Call {@link AttachmentManager.pruneAttachments} to scan all consumers
 * - Attachments not referenced by any consumer are marked as unused
 * - Unused attachments can be removed to reclaim storage space
 *
 * @example
 * ```typescript
 * // Add an image attachment
 * const imageBlob = await fetch('/path/to/image.png').then(r => r.blob());
 * const attachment = await attachmentManager.addAttachment(imageBlob);
 *
 * // Use the attachment in a node
 * node.props.image = attachment.hash;
 *
 * // Later, retrieve the attachment
 * const storedAttachment = attachmentManager.getAttachment(attachment.hash);
 * if (storedAttachment) {
 *   // Use the object URL directly in an img tag
 *   imageElement.src = storedAttachment.url;
 *
 *   // Or convert to data URL if needed
 *   const dataUrl = await storedAttachment.getDataUrl();
 * }
 *
 * // Periodically clean up unused attachments
 * attachmentManager.pruneAttachments();
 * ```
 *
 * @see {@link Attachment} - Individual attachment representation
 * @see {@link AttachmentManager} - Attachment storage and management
 * @see {@link AttachmentConsumer} - Interface for reference tracking
 */

import type { DiagramDocument } from './diagramDocument';
import { hash64 } from '@diagram-craft/utils/hash';
import { blobToDataURL } from '@diagram-craft/utils/blobUtils';
import type { CRDTMap, CRDTRoot } from '@diagram-craft/collaboration/crdt';
import type { Releasable } from '@diagram-craft/utils/releasable';

/**
 * Represents a binary attachment (image, file, etc.) in a diagram document.
 *
 * Attachments are content-addressed, meaning each is uniquely identified by a hash
 * of its binary content. This enables automatic deduplication where identical content
 * is stored only once.
 *
 * @remarks
 * Attachments are immutable once created. The content, hash, and URL cannot be changed.
 * To modify an attachment's content, create a new attachment with the updated content.
 *
 * The object URL is automatically created for browser access and should be used for
 * rendering images or other binary content in the DOM. Object URLs are more efficient
 * than data URLs as they avoid Base64 encoding overhead.
 *
 * @example
 * ```typescript
 * // Create from a Blob (async, computes hash)
 * const attachment = await Attachment.create(imageBlob);
 * console.log(`Hash: ${attachment.hash}`);
 * console.log(`URL: ${attachment.url}`);
 *
 * // Use in an img element
 * imgElement.src = attachment.url;
 *
 * // Convert to data URL if needed (e.g., for export)
 * const dataUrl = await attachment.getDataUrl();
 * ```
 */
export class Attachment {
  /**
   * Content hash uniquely identifying this attachment.
   * Computed using 64-bit hash of the binary content.
   */
  readonly hash: string;

  /**
   * The binary content of the attachment as a Blob.
   * Preserves the original content type (MIME type) of the data.
   */
  readonly content: Blob;

  /**
   * Object URL for direct browser access to the blob content.
   *
   * @remarks
   * This URL can be used directly in `src` attributes of `<img>` elements or
   * other DOM contexts. Object URLs are more efficient than data URLs as they
   * avoid Base64 encoding.
   *
   * Note: Object URLs are managed by the browser and remain valid for the
   * lifetime of the attachment object.
   */
  readonly url: string;

  /**
   * Whether this attachment is currently referenced by any diagram element.
   *
   * @remarks
   * This flag is maintained by {@link AttachmentManager.pruneAttachments} based
   * on reports from {@link AttachmentConsumer} instances. It can be used to
   * identify candidates for garbage collection.
   */
  inUse: boolean;

  /**
   * Creates a new attachment instance.
   *
   * @param hash - Content hash identifying this attachment
   * @param content - Binary content as a Blob
   * @param inUse - Whether the attachment is currently referenced (default: true)
   *
   * @internal
   * @remarks
   * Typically, you should use the static {@link Attachment.create} method instead,
   * which automatically computes the hash from content. This constructor is used
   * internally when reconstructing attachments from storage.
   */
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

  /**
   * Creates an attachment with automatically computed hash from content.
   *
   * @param content - Binary content to create an attachment from
   * @returns A promise resolving to the created attachment
   *
   * @remarks
   * This is the preferred way to create new attachments. The content hash is
   * computed using a 64-bit hash function on the binary data, ensuring unique
   * identification and enabling deduplication.
   *
   * @example
   * ```typescript
   * const imageBlob = await fetch('/image.png').then(r => r.blob());
   * const attachment = await Attachment.create(imageBlob);
   * console.log(`Created attachment with hash: ${attachment.hash}`);
   * ```
   */
  static async create(content: Blob) {
    const hash = hash64(new Uint8Array(await content.arrayBuffer()));
    return new Attachment(hash, content);
  }

  /**
   * Converts the attachment content to a Base64-encoded data URL.
   *
   * @returns A promise resolving to a data URL string (e.g., "data:image/png;base64,...")
   *
   * @remarks
   * Data URLs are useful for:
   * - Exporting diagrams with embedded images
   * - Sharing diagrams as standalone HTML
   * - Contexts where object URLs cannot be used
   *
   * However, data URLs are less efficient than object URLs for in-browser use
   * due to Base64 encoding overhead. Prefer using the {@link url} property
   * for rendering in the DOM.
   *
   * @example
   * ```typescript
   * const dataUrl = await attachment.getDataUrl();
   * // dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANS..."
   * ```
   */
  async getDataUrl() {
    return blobToDataURL(this.content);
  }
}

/**
 * Interface for objects that reference and use attachments.
 *
 * Implemented by diagram elements (nodes, edges, etc.) that contain references to
 * attachments. This enables the attachment manager to track which attachments are
 * actively used and perform garbage collection of unused attachments.
 *
 * @remarks
 * Consumers report attachment usage by returning an array of attachment hashes.
 * The {@link AttachmentManager} periodically calls {@link getAttachmentsInUse} on
 * all registered consumers to determine which attachments should be kept.
 *
 * @example
 * ```typescript
 * class DiagramNode implements AttachmentConsumer {
 *   props: { image?: string };
 *
 *   getAttachmentsInUse(): string[] {
 *     // Return array of attachment hashes used by this node
 *     return this.props.image ? [this.props.image] : [];
 *   }
 * }
 * ```
 */
export interface AttachmentConsumer {
  /**
   * Returns an array of attachment hashes currently used by this consumer.
   *
   * @returns Array of attachment hash strings. Empty array if no attachments are used.
   *
   * @remarks
   * This method should scan all properties and return hashes of any attachments
   * that are referenced. It's called during garbage collection to determine which
   * attachments should be marked as in-use.
   */
  getAttachmentsInUse(): Array<string>;
}

/**
 * CRDT-serializable representation of an attachment for collaborative editing.
 *
 * @internal
 */
type AttachmentCRDT = {
  /** Content hash identifying this attachment */
  hash: string;

  /** Binary content stored as a Uint8Array for CRDT serialization */
  content: Uint8Array;

  /** MIME type of the content (e.g., "image/png", "image/jpeg") */
  contentType: string;

  /** Whether this attachment is currently referenced by diagram elements.*/
  inUse?: boolean;
};

/**
 * Manages all attachments for a diagram document with CRDT synchronization.
 *
 * Provides centralized storage, retrieval, and lifecycle management of binary
 * attachments. Implements automatic deduplication based on content hashing and
 * garbage collection of unreferenced attachments.
 *
 * @remarks
 * The attachment manager integrates with the CRDT system to enable real-time
 * collaborative editing. All attachment operations are automatically synchronized
 * across connected clients.
 *
 * ## Deduplication
 *
 * When adding attachments, identical content (same hash) is stored only once.
 * Multiple diagram elements can reference the same attachment without duplicating
 * the binary data.
 *
 * ## Garbage Collection
 *
 * The manager tracks which attachments are actively used through registered
 * {@link AttachmentConsumer} instances. Call {@link pruneAttachments} periodically
 * to mark unused attachments, which can then be removed to reclaim storage.
 *
 * @example
 * ```typescript
 * // Create manager for a diagram
 * const manager = new AttachmentManager(crdtRoot, diagramDocument);
 *
 * // Add an image
 * const imageBlob = await fetch('/logo.png').then(r => r.blob());
 * const attachment = await manager.addAttachment(imageBlob);
 *
 * // Store hash in a node property
 * node.props.logo = attachment.hash;
 *
 * // Later retrieve it
 * const logo = manager.getAttachment(node.props.logo);
 * if (logo) {
 *   imgElement.src = logo.url;
 * }
 *
 * // Clean up unused attachments periodically
 * manager.pruneAttachments();
 *
 * // Get all attachments
 * for (const [hash, attachment] of manager.attachments) {
 *   console.log(`${hash}: ${attachment.inUse ? 'used' : 'unused'}`);
 * }
 * ```
 */
export class AttachmentManager implements Releasable {
  /** CRDT map storing serialized attachment data */
  #attachments: CRDTMap<Record<string, AttachmentCRDT>>;

  /** Registered consumers that report attachment usage */
  #consumers: Array<AttachmentConsumer> = [];

  /**
   * Creates a new attachment manager for a diagram.
   *
   * @param root - CRDT root for synchronized storage
   * @param diagramDocument - The diagram document to manage attachments for
   *
   * @remarks
   * The diagram document is automatically registered as a consumer, allowing it
   * to report which attachments are used by its nodes and edges.
   */
  public constructor(
    private readonly root: CRDTRoot,
    diagramDocument: DiagramDocument
  ) {
    this.#consumers.push(diagramDocument);
    this.#attachments = root.getMap('attachmentManager');
  }

  /**
   * Releases resources held by this manager.
   */
  release() {}

  /**
   * Adds an attachment to the manager with automatic deduplication.
   *
   * @param content - Binary content to add as a Blob
   * @returns A promise resolving to the created or existing attachment
   *
   * @example
   * ```typescript
   * // Add a new image
   * const imageBlob = await fetch('/diagram.png').then(r => r.blob());
   * const attachment = await manager.addAttachment(imageBlob);
   * console.log(`Added with hash: ${attachment.hash}`);
   *
   * // Adding identical content returns the same attachment
   * const duplicate = await manager.addAttachment(imageBlob);
   * console.log(duplicate.hash === attachment.hash); // true
   * ```
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

  /**
   * Returns all attachments stored in the manager.
   *
   * @returns Array of [hash, attachment] tuples for all stored attachments
   *
   * @example
   * ```typescript
   * // List all unused attachments
   * const unused = manager.attachments
   *   .filter(([_, att]) => !att.inUse)
   *   .map(([hash, _]) => hash);
   * console.log(`Unused attachments: ${unused.join(', ')}`);
   * ```
   */
  get attachments(): Array<[string, Attachment]> {
    return Array.from(this.#attachments.entries()).map(([hash, ad]) => [
      hash,
      new Attachment(ad.hash, new Blob([new Uint8Array(ad.content)], { type: ad.contentType }))
    ]);
  }

  /**
   * Retrieves an attachment by its content hash.
   *
   * @param hash - Content hash of the attachment to retrieve
   * @returns The attachment if found, or undefined if not found
   *
   * @example
   * ```typescript
   * const hash = node.props.backgroundImage;
   * const attachment = manager.getAttachment(hash);
   * if (attachment) {
   *   // Use the attachment
   *   element.style.backgroundImage = `url(${attachment.url})`;
   * } else {
   *   console.warn(`Attachment ${hash} not found`);
   * }
   * ```
   */
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
   * Updates the usage status of all attachments based on consumer reports.
   *
   * Call this method periodically (e.g., after significant diagram changes, before
   * saving, or on a timer) to maintain accurate usage information.
   *
   * @example
   * ```typescript
   * // Run garbage collection after deleting nodes
   * diagram.removeNode(nodeId);
   * attachmentManager.pruneAttachments();
   *
   * // Check for unused attachments
   * const unused = attachmentManager.attachments
   *   .filter(([_, att]) => !att.inUse);
   * console.log(`Found ${unused.length} unused attachments`);
   *
   * // Optionally remove unused attachments
   * for (const [hash, _] of unused) {
   *   // Remove from storage (not implemented in this example)
   * }
   * ```
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
