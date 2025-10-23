import { Awareness, NoOpAwareness, type AwarenessUserState } from './awareness';
import type { CRDTRoot } from './crdt';
import type { ProgressCallback } from '@diagram-craft/utils/progress';

export interface CollaborationBackend {
  connect: (
    url: string,
    doc: CRDTRoot,
    userState: AwarenessUserState,
    callback: ProgressCallback
  ) => Promise<void>;
  disconnect: (callback: ProgressCallback) => void;
  awareness: Awareness | undefined;
  isMultiUser: boolean;
}

export class NoOpCollaborationBackend implements CollaborationBackend {
  readonly awareness: Awareness = new NoOpAwareness();

  isMultiUser = false;

  async connect(
    _url: string,
    _doc: CRDTRoot,
    _userState: AwarenessUserState,
    callback: ProgressCallback
  ) {
    callback('complete', {});
  }
  disconnect(callback: ProgressCallback) {
    callback('complete', {});
  }
}
