import { Awareness, NoOpAwareness } from './awareness';
import { CRDTRoot } from './crdt';

export interface CollaborationBackend {
  connect: (url: string, doc: CRDTRoot) => Promise<void>;
  disconnect: () => void;
  awareness: Awareness | undefined;
}

export class NoOpCollaborationBackend implements CollaborationBackend {
  readonly awareness: Awareness = new NoOpAwareness();

  async connect() {}
  disconnect() {}
}
