// biome-ignore lint/correctness/noUndeclaredDependencies: this is a vite alias
import defineAppConfig from '@diagram-craft/config';
import { defaultAppConfig } from './appConfig.default';
import { fileLoaderRegistry } from '@diagram-craft/canvas-app/loaders';
import { AppConfig } from './appConfig';
import { Autosave } from './react-app/autosave/Autosave';
import { stencilLoaderRegistry } from '@diagram-craft/model/elementDefinitionRegistry';
import { CollaborationConfig } from '@diagram-craft/collaboration/collaborationConfig';
import { YJSMap, YJSRoot } from '@diagram-craft/collaboration/yjs/yjsCrdt';
import { YJSWebSocketCollaborationBackend } from '@diagram-craft/collaboration/yjs/yjsWebsocketCollaborationBackend';

const config = defineAppConfig(defaultAppConfig);
AppConfig.set(config);

// Initialize collaboration
if (config.collaboration.backend === 'yjs') {
  CollaborationConfig.isNoOp = false;
  CollaborationConfig.CRDTRoot = YJSRoot;
  CollaborationConfig.CRDTMap = YJSMap;
  CollaborationConfig.Backend = new YJSWebSocketCollaborationBackend(
    config.collaboration.config.url
  );
}

// Initialize file loaders
for (const [k, v] of Object.entries(config.file.loaders)) {
  fileLoaderRegistry[k] = v;
}

// Initialize stencil loaders
for (const [k, v] of Object.entries(config.stencils.loaders)) {
  // @ts-expect-error
  stencilLoaderRegistry[k] = v;
}

Autosave.init(config.autosave);
