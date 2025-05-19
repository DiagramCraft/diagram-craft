import * as awarenessProtocol from 'y-protocols/awareness.js';
import { unique } from '@diagram-craft/utils/array';

type UserState = {
  name: string;
};

export class Awareness {
  private backend: awarenessProtocol.Awareness | undefined = undefined;

  private userState: UserState | undefined = undefined;

  constructor() {}

  setBackend(backend: awarenessProtocol.Awareness) {
    this.backend = backend;

    if (this.userState) this.backend.setLocalStateField('user', this.userState);

    this.backend.on('change', () => {
      // Whenever somebody updates their awareness information,
      // we log all awareness information from all users.
      console.log(
        unique(Array.from(this.backend!.getStates().values()).map(s => s.user.name)).join(', ')
      );
    });
  }

  updateUser(state: UserState) {
    this.userState = state;
    this.backend!.setLocalStateField('user', state);
  }
}
