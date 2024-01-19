import { DiagramDocument } from './diagramDocument.ts';
import { isEdge, isNode } from './diagramElement.ts';

export class Attachment {
  hash: string;
  content: Blob;
  inUse: boolean;

  #url: string;

  constructor(hash: string, content: Blob) {
    this.hash = hash;
    this.content = content;
    this.inUse = true;

    this.#url = URL.createObjectURL(new Blob([this.content]));
  }

  static async create(content: Blob) {
    const hash = hash64(await content.arrayBuffer());
    return new Attachment(hash, content);
  }

  get url() {
    return this.#url;
  }

  /*detach() {
    URL.revokeObjectURL(this.#url);
  }*/
}

export class AttachmentManager {
  #attachments: Map<string, Attachment> = new Map();

  public constructor(private readonly diagramDocument: DiagramDocument) {}

  async addAttachment(content: Blob): Promise<Attachment> {
    const att = await Attachment.create(content);

    if (this.#attachments.has(att.hash)) {
      return this.#attachments.get(att.hash)!;
    }

    this.#attachments.set(att.hash, att);
    return att;
  }

  // TODO: Also need to check it's not part of the undo stack
  //       ... or find some other way to handle that
  pruneAttachments() {
    const used = new Set<string | undefined>();
    for (const diagram of this.diagramDocument.diagrams) {
      for (const layer of diagram.layers.all) {
        for (const element of layer.elements) {
          if (isNode(element)) {
            const props = element.props;
            used.add(props.fill?.image?.url);
            used.add(props.fill?.pattern);
          } else if (isEdge(element)) {
            // No attachments possible for edges
          }
        }
      }
    }

    for (const hash of this.#attachments.keys()) {
      // The inuse flag is used to prevent unused attachments from being saved
      this.#attachments.get(hash)!.inUse = used.has(hash);
    }
  }
}

// See https://stackoverflow.com/questions/7616461/generate-a-hash-from-string-in-javascript
const hash64 = (str: ArrayBuffer, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  let ch: number = 0;

  const arr = new Uint8Array(str);
  for (let i = 0; i < arr.byteLength; i++) {
    ch = arr[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};
