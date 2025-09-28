import * as awarenessProtocol from 'y-protocols/awareness.js';
import { Awareness, AwarenessEvents, AwarenessCursorState, AwarenessUserState } from '../awareness';
import { EventEmitter } from '@diagram-craft/utils/event';

export class YJSAwareness extends EventEmitter<AwarenessEvents> implements Awareness {
  private backend: awarenessProtocol.Awareness | undefined = undefined;

  private userState: AwarenessUserState | undefined = undefined;
  private userStates: Array<AwarenessUserState> = [];
  private cursorStates: Array<AwarenessUserState & AwarenessCursorState> = [];

  setBackend(backend: awarenessProtocol.Awareness) {
    this.backend?.destroy();

    this.backend = backend;

    if (this.userState) this.backend.setLocalStateField('user', this.userState);

    this.backend.on('change', () => {
      super.emit('changeUser', {});
      super.emit('changeCursor', {});

      this.userStates = Array.from(this.backend!.getStates().values())
        .filter(s => !!s)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        .map(s => s.user);
      this.cursorStates = Array.from(
        this.backend!.getStates()
          .entries()
          // Hide ourselves
          .filter(e => e[0] !== this.backend!.clientID)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          .map(s => ({ ...s[1].cursor, ...s[1].user }))
          .filter(k => !!k)
      );
    });
  }

  getUserStates() {
    return this.userStates;
  }

  getCursorStates(): Array<AwarenessUserState & AwarenessCursorState> {
    return this.cursorStates;
  }

  updateCursor(state: AwarenessCursorState) {
    this.backend!.setLocalStateField('cursor', state);
  }

  updateUser(state: AwarenessUserState) {
    this.userState = state;
    this.backend!.setLocalStateField('user', state);
  }
}
