import { DiagramDocument } from './diagramDocument';
import { hash64 } from '@diagram-craft/utils/hash';
import { CRDTMap, CRDTRoot } from './collaboration/crdt';

export const blobToDataURL = (blob: Blob): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = _e => resolve(reader.result as string);
    reader.onerror = _e => reject(reader.error);
    reader.onabort = _e => reject(new Error('Read aborted'));
    reader.readAsDataURL(blob);
  });

export class Attachment {
  hash: string;
  content: Blob;
  inUse: boolean;

  #url: string;

  constructor(hash: string, content: Blob, inUse = true) {
    this.hash = hash;
    this.content = content;
    this.inUse = inUse;

    this.#url = URL.createObjectURL(
      new Blob([this.content], {
        type: this.content.type
      })
    );
  }

  static async create(content: Blob) {
    const hash = hash64(new Uint8Array(await content.arrayBuffer()));
    return new Attachment(hash, content);
  }

  get url() {
    return this.#url;
  }

  async getDataUrl() {
    return blobToDataURL(this.content);
  }
}

export interface AttachmentConsumer {
  getAttachmentsInUse(): Array<string>;
}

type AttachmentData = {
  hash: string;
  content: Uint8Array;
  contentType: string;
  inUse?: boolean;
};

export class AttachmentManager {
  #attachments: CRDTMap<AttachmentData>;
  #consumers: Array<AttachmentConsumer> = [];

  public constructor(
    private readonly root: CRDTRoot,
    diagramDocument: DiagramDocument
  ) {
    this.#consumers.push(diagramDocument);
    this.#attachments = root.getMap('attachmentManager');
  }

  async addAttachment(content: Blob): Promise<Attachment> {
    const att = await Attachment.create(content);

    if (this.#attachments.has(att.hash)) {
      return this.getAttachment(att.hash);
    }

    this.#attachments.set(att.hash, {
      hash: att.hash,
      inUse: att.inUse,
      contentType: content.type,
      content: await att.content.bytes()
    });

    return att;
  }

  get attachments(): Array<[string, Attachment]> {
    return Array.from(this.#attachments.entries()).map(([hash, ad]) => [
      hash,
      new Attachment(ad.hash, new Blob([ad.content], { type: ad.contentType }))
    ]);
  }

  getAttachment(hash: string) {
    const ad = this.#attachments.get(hash)!;
    return new Attachment(ad.hash, new Blob([ad.content], { type: ad.contentType }), ad.inUse);
  }

  pruneAttachments() {
    const used = new Set([...this.#consumers.flatMap(c => c.getAttachmentsInUse())]);

    this.root.transact(() => {
      for (const hash of this.#attachments.keys()) {
        const d = this.#attachments.get(hash);
        d!.inUse = used.has(hash);
        this.#attachments.set(hash, d!);
      }
    });
  }
}
