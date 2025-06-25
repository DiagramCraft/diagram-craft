import { YJSWebSocketCollaborationBackend } from '@diagram-craft/model/collaboration/yjs/yjsWebsocketCollaborationBackend';
import { YJSMap, YJSRoot } from '@diagram-craft/model/collaboration/yjs/yjsCrdt';
import { CollaborationConfig } from '@diagram-craft/model/collaboration/collaborationConfig';

if (import.meta.env.VITE_CRDT_BACKEND === 'yjs-websocket') {
  CollaborationConfig.idNoOp = false;
  CollaborationConfig.CRDTRoot = YJSRoot;
  CollaborationConfig.CRDTMap = YJSMap;
  CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend(
    import.meta.env.VITE_CRDT_BACKEND_YJS_URL
  );
}
