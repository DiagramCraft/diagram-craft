import { Emitter, EventEmitter } from '@diagram-craft/utils/event';
import { EmptyObject } from '@diagram-craft/utils/types';

export type AwarenessUserState = {
  name: string;
  color: string;
};

export type AwarenessCursorState = {
  x: number;
  y: number;
  activeDiagramId: string;
};

export type AwarenessEvents = {
  changeUser: EmptyObject;
  changeCursor: EmptyObject;
};

export interface Awareness extends Emitter<AwarenessEvents> {
  updateUser(state: AwarenessUserState): void;
  updateCursor(state: AwarenessCursorState): void;
  getUserStates(): Array<AwarenessUserState>;
  getCursorStates(): Array<AwarenessUserState & AwarenessCursorState>;
}

export class NoOpAwareness extends EventEmitter<AwarenessEvents> implements Awareness {

  updateUser() {}
  updateCursor() {}

  getUserStates(): AwarenessUserState[] {
    return [];
  }

  getCursorStates(): Array<AwarenessUserState & AwarenessCursorState> {
    return [];
  }
}
