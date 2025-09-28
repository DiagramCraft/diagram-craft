import type { DiagramDocument } from './diagramDocument';
import { hash64 } from '@diagram-craft/utils/hash';
import { CRDTMap, CRDTRoot } from './collaboration/crdt';
import { blobToDataURL } from '@diagram-craft/utils/blobUtils';

export class Attachment {
  readonly hash: string;
  readonly content: Blob;
  readonly url: string;

  // This is used only for pruning
  inUse: boolean;

  constructor(hash: string, content: Blob, inUse = true) {
    this.hash = hash;
    this.content = content;
    this.inUse = inUse;

    this.url = URL.createObjectURL(
      new Blob([this.content], {
        type: this.content.type
      })
    );
  }

  static async create(content: Blob) {
    const hash = hash64(new Uint8Array(await content.arrayBuffer()));
    return new Attachment(hash, content);
  }

  async getDataUrl() {
    return blobToDataURL(this.content);
  }
}

export interface AttachmentConsumer {
  getAttachmentsInUse(): Array<string>;
}

type AttachmentCRDT = {
  hash: string;
  content: Uint8Array;
  contentType: string;
  inUse?: boolean;
};

export class AttachmentManager {
  #attachments: CRDTMap<Record<string, AttachmentCRDT>>;
  #consumers: Array<AttachmentConsumer> = [];

  public constructor(
    private readonly root: CRDTRoot,
    diagramDocument: DiagramDocument
  ) {
    this.#consumers.push(diagramDocument);
    this.#attachments = root.getMap('attachmentManager');
  }

  async addAttachment(content: Blob): Promise<Attachment> {
    const attachment = await Attachment.create(content);

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

  get attachments(): Array<[string, Attachment]> {
    return Array.from(this.#attachments.entries()).map(([hash, ad]) => [
      hash,
      new Attachment(ad.hash, new Blob([new Uint8Array(ad.content)], { type: ad.contentType }))
    ]);
  }

  getAttachment(hash: string) {
    const ad = this.#attachments.get(hash);
    if (!ad) return undefined;
    return new Attachment(
      ad.hash,
      new Blob([new Uint8Array(ad.content)], { type: ad.contentType }),
      ad.inUse
    );
  }

  pruneAttachments() {
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
