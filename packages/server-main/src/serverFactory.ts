import type { ServerMainConfig } from './config';
import { OpenRouterAIServer } from './aiServer';
import { FileBackedModelServer } from './dataStore';
import { LocalFileSystemServer } from './filesystemServer';
import type {
  AIServer,
  CollaborationServer,
  FileSystemServer,
  ModelServer
} from './serverInterfaces';
import { YJS_WEBSOCKET_PATH, YjsCollaborationServer } from './websocket';

export type ServerModules = {
  modelServer: ModelServer;
  aiServer?: AIServer;
  aiDefaultModel?: string;
  fileSystemServer: FileSystemServer;
  collaborationServer: CollaborationServer;
};

export const createServerModules = (config: ServerMainConfig): ServerModules => {
  const modelServer = new FileBackedModelServer(config.dataDir);

  if (config.bootstrapData && config.bootstrapSchemas) {
    modelServer.bootstrap?.({
      dataFile: config.bootstrapData,
      schemasFile: config.bootstrapSchemas
    });
  } else if (config.bootstrapData || config.bootstrapSchemas) {
    console.warn('Both --bootstrap-data and --bootstrap-schemas must be provided for bootstrapping');
  }

  const aiServer =
    config.openrouterApiKey === undefined
      ? undefined
      : new OpenRouterAIServer({
          apiKey: config.openrouterApiKey,
          defaultModel: config.openrouterModel,
          siteUrl: config.openrouterSiteUrl,
          appName: config.openrouterAppName
        });

  return {
    modelServer,
    aiServer,
    aiDefaultModel: config.openrouterModel,
    fileSystemServer: new LocalFileSystemServer(config.fsRoot),
    collaborationServer: new YjsCollaborationServer(YJS_WEBSOCKET_PATH)
  };
};
