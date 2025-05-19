import { WebsocketProvider } from 'y-websocket';
import { CRDTRoot } from '../crdt';
import { assert } from '@diagram-craft/utils/assert';
import { YJSRoot } from './yjsCrdt';
import { CollaborationBackend } from '../backend';
import { YJSAwareness } from './yjsAwareness';

export class YJSWebSocketCollaborationBackend implements CollaborationBackend {
  private wsProvider: WebsocketProvider | undefined = undefined;

  readonly awareness: YJSAwareness = new YJSAwareness();

  constructor(private readonly endpoint: string) {}

  connect(url: string, root: CRDTRoot) {
    assert.true(root instanceof YJSRoot);

    const doc = (root as YJSRoot).yDoc;

    this.wsProvider = new WebsocketProvider(this.endpoint, url, doc);
    this.awareness.setBackend(this.wsProvider.awareness);

    // TODO: This should be removed
    this.awareness?.updateUser({
      name: navigator.userAgent.includes('Edg') ? 'Edge' : 'Chrome'
    });
  }

  disconnect() {
    const p = this.wsProvider;
    setTimeout(() => {
      p?.disconnect();
    }, 1000);
  }
}
