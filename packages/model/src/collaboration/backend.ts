import { Awareness, NoOpAwareness } from './awareness';
import { CRDTRoot } from './crdt';

export interface CollaborationBackend {
  connect: (url: string, doc: CRDTRoot) => void;
  disconnect: () => void;
  awareness: Awareness | undefined;
}

export class NoOpCollaborationBackend implements CollaborationBackend {
  readonly awareness: Awareness = new NoOpAwareness();

  connect() {}
  disconnect() {}
}
