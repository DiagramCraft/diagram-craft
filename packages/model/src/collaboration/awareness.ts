import { Emitter, EventEmitter } from '@diagram-craft/utils/event';
import { EmptyObject } from '@diagram-craft/utils/types';

export type UserState = {
  name: string;
  color: string;
};

export type CursorState = {
  x: number;
  y: number;
};

export type AwarenessEvents = {
  changeUser: EmptyObject;
  changeCursor: EmptyObject;
};

export interface Awareness extends Emitter<AwarenessEvents> {
  updateUser(state: UserState): void;
  updateCursor(state: CursorState): void;
  getUserStates(): Array<UserState>;
  getCursorStates(): Array<UserState & CursorState>;
}

export class NoOpAwareness extends EventEmitter<AwarenessEvents> implements Awareness {
  constructor() {
    super();
  }

  updateUser() {}
  updateCursor() {}

  getUserStates(): UserState[] {
    return [];
  }

  getCursorStates(): Array<UserState & CursorState> {
    return [];
  }
}
