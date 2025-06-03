import { WebsocketProvider } from 'y-websocket';
import { CRDTRoot } from '../crdt';
import { assert } from '@diagram-craft/utils/assert';
import { YJSRoot } from './yjsCrdt';
import { CollaborationBackend } from '../backend';
import { YJSAwareness } from './yjsAwareness';
import { Random } from '@diagram-craft/utils/random';

const random = new Random(new Date().getTime());

export class YJSWebSocketCollaborationBackend implements CollaborationBackend {
  private wsProvider: WebsocketProvider | undefined = undefined;

  isConnected = false;
  readonly awareness: YJSAwareness = new YJSAwareness();

  constructor(private readonly endpoint: string) {}

  async connect(url: string, root: CRDTRoot) {
    if (this.isConnected) return;
    assert.true(root instanceof YJSRoot);

    const doc = (root as YJSRoot).yDoc;

    this.wsProvider = new WebsocketProvider(this.endpoint, url, doc);
    this.wsProvider.on('sync', () => {
      console.log('Sync');
    });
    this.wsProvider.on('status', e => {
      console.log('Status: ' + e.status);
    });

    this.awareness.setBackend(this.wsProvider.awareness);

    // TODO: This should be removed
    this.awareness?.updateUser({
      name: navigator.userAgent.includes('Edg') ? 'Edge' : 'Chrome',
      color: random.pick(['red', 'green', 'blue', 'orange'])
    });

    return new Promise<void>((resolve, reject) => {
      this.wsProvider!.on('status', e => {
        if (e.status === 'connected') {
          this.isConnected = true;
          resolve();
        } else if (e.status === 'disconnected') {
          reject(new Error('Disconnected'));
        }
      });
    });
  }

  disconnect() {
    const p = this.wsProvider;
    setTimeout(() => {
      p?.disconnect();
      this.isConnected = false;
    }, 10);
  }
}
