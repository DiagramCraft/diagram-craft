import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Awareness } from './awareness';

export interface CollaborationBackend {
  connect: (url: string, doc: Y.Doc) => void;
  disconnect: () => void;
  awareness: Awareness | undefined;
}

export class YJSWebSocketCollaborationBackend implements CollaborationBackend {
  private wsProvider: WebsocketProvider | undefined = undefined;

  readonly awareness: Awareness = new Awareness();

  constructor(private readonly endpoint: string) {}

  connect(url: string, doc: Y.Doc) {
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

export class NoOpCollaborationBackend implements CollaborationBackend {
  readonly awareness: Awareness = new Awareness();

  connect() {}
  disconnect() {}
}

export const COLLABORATION_BACKEND_CONFIG = {
  backend: new YJSWebSocketCollaborationBackend('ws://localhost:1234')
};
