import { DiagramDocument } from './diagramDocument';
import { hash64 } from '@diagram-craft/utils/hash';

const blobToDataURL = (blob: Blob): Promise<string> =>
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

  constructor(hash: string, content: Blob) {
    this.hash = hash;
    this.content = content;
    this.inUse = true;

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

  /*detach() {
    URL.revokeObjectURL(this.#url);
  }*/
}

export interface AttachmentConsumer {
  getAttachmentsInUse(): Array<string>;
}

export class AttachmentManager {
  // TODO: Maybe we can make this a weak hashmap?
  #attachments: Map<string, Attachment> = new Map();
  #consumers: Array<AttachmentConsumer> = [];

  // @ts-ignore
  public constructor(private readonly diagramDocument: DiagramDocument) {
    this.#consumers.push(diagramDocument);
  }

  async addAttachment(content: Blob): Promise<Attachment> {
    const att = await Attachment.create(content);

    if (this.#attachments.has(att.hash)) {
      return this.#attachments.get(att.hash)!;
    }

    this.#attachments.set(att.hash, att);
    return att;
  }

  get attachments() {
    return this.#attachments.entries();
  }

  getAttachment(hash: string) {
    return this.#attachments.get(hash);
  }

  pruneAttachments() {
    const used = new Set([...this.#consumers.flatMap(c => c.getAttachmentsInUse())]);

    for (const hash of this.#attachments.keys()) {
      this.#attachments.get(hash)!.inUse = used.has(hash);
    }
  }
}
