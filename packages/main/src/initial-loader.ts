import { YJSWebSocketCollaborationBackend } from '@diagram-craft/model/collaboration/yjs/yjsWebsocketCollaborationBackend';
import { YJSRoot } from '@diagram-craft/model/collaboration/yjs/yjsCrdt';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';

if (import.meta.env.VITE_CRDT_BACKEND === 'yjs-websocket') {
  CollaborationConfig.CRDTRoot = YJSRoot;
  CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend(
    import.meta.env.VITE_CRDT_BACKEND_YJS_URL
  );
}
