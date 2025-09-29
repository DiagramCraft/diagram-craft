import { WebsocketProvider } from 'y-websocket';
import { CRDTRoot } from '../crdt';
import { assert } from '@diagram-craft/utils/assert';
import { YJSRoot } from './yjsCrdt';
import { CollaborationBackend } from '../backend';
import { YJSAwareness } from './yjsAwareness';
import { ProgressCallback } from '../../types';
import type { AwarenessUserState } from '../awareness';

export class YJSWebSocketCollaborationBackend implements CollaborationBackend {
  private wsProvider: WebsocketProvider | undefined = undefined;

  isMultiUser = true;

  isConnected = false;
  readonly awareness: YJSAwareness = new YJSAwareness();

  #state: 'disconnected' | 'connecting' | 'connected' | 'synced' = 'disconnected';

  constructor(private readonly endpoint: string) {}

  async connect(
    url: string,
    root: CRDTRoot,
    userState: AwarenessUserState,
    callback: ProgressCallback
  ) {
    if (this.isConnected && this.#state !== 'disconnected') return;
    assert.true(root instanceof YJSRoot);

    const doc = (root as YJSRoot).yDoc;

    this.wsProvider = new WebsocketProvider(this.endpoint, url, doc);
    this.#state = 'connecting';
    this.wsProvider.on('sync', () => {
      console.log('Sync');
    });
    this.wsProvider.on('status', e => {
      console.log(`Status: ${e.status}`);
    });

    this.awareness.setBackend(this.wsProvider.awareness);
    this.awareness?.updateUser(userState);

    return new Promise<void>((resolve, reject) => {
      callback('pending', { message: 'Connecting', completion: 0 });
      this.wsProvider!.on('sync', sync => {
        if (sync && this.#state === 'connected') {
          this.#state = 'synced';
          callback('complete', { message: 'Connected', completion: 100 });

          resolve();
        }
      });
      this.wsProvider!.on('status', e => {
        if (e.status === 'connected') {
          this.isConnected = true;
          this.#state = 'connected';
          callback('pending', { message: 'Syncing', completion: 50 });
        } else if (e.status === 'disconnected') {
          this.#state = 'disconnected';
          callback('error', { message: 'Connection failed' });

          reject(new Error('Disconnected'));
        }
      });
    });
  }

  disconnect() {
    const p = this.wsProvider;
    p?.disconnect();
    this.isConnected = false;
  }
}
