import { DiagramDocument } from './diagramDocument.ts';
import { isEdge, isNode } from './diagramElement.ts';
import { hash64 } from '@diagram-craft/utils';

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
    const hash = hash64(new Uint8Array(await content.arrayBuffer()));
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
  // TODO: Maybe we can make this a weak hashmap?
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

  getAttachment(hash: string) {
    return this.#attachments.get(hash);
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
