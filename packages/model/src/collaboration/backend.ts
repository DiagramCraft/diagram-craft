import { Awareness, NoOpAwareness } from './awareness';
import { CRDTRoot } from './crdt';
import { ProgressCallback } from '../types';

export interface CollaborationBackend {
  connect: (url: string, doc: CRDTRoot, callback: ProgressCallback) => Promise<void>;
  disconnect: (callback: ProgressCallback) => void;
  awareness: Awareness | undefined;
  isMultiUser: boolean;
}

export class NoOpCollaborationBackend implements CollaborationBackend {
  readonly awareness: Awareness = new NoOpAwareness();

  isMultiUser = false;

  async connect(_url: string, _doc: CRDTRoot, callback: ProgressCallback) {
    callback('complete', {});
  }
  disconnect(callback: ProgressCallback) {
    callback('complete', {});
  }
}
