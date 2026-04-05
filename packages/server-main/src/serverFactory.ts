import type { ServerMainConfig } from './config';
import { FileBackedModelServer } from './default/fileBackedModelServer';
import { LocalFileSystemServer } from './default/filesystemServer';
import { OpenRouterAIServer } from './default/openRouterAiServer';
import { YJS_WEBSOCKET_PATH, YjsCollaborationServer } from './default/yjsCollaborationServer';
import type { AIServer } from './aiServer';
import type { CollaborationServer } from './collaborationServer';
import type { FileSystemServer } from './fileSystemServer';
import type { ModelServer } from './modelServer';
import { createLogger } from './logger';

const log = createLogger('serverFactory');

export type ServerModules = {
  modelServer: ModelServer;
  aiServer?: AIServer;
  aiDefaultModel?: string;
  fileSystemServer: FileSystemServer;
  collaborationServer: CollaborationServer;
};

export const createServerModules = (config: ServerMainConfig): ServerModules => {
  const modelServer = new FileBackedModelServer(config.dataDir);

  // Lazy reference resolved before the writer is ever called (writer fires on Y.Doc
  // updates which only happen after clients connect, well after construction)
  let fileSystemServer!: FileSystemServer;
  const collaborationServer = new YjsCollaborationServer(
    YJS_WEBSOCKET_PATH,
    (relPath, content) =>
      fileSystemServer.put(relPath, { body: content, contentType: 'application/json' })
  );

  fileSystemServer = new LocalFileSystemServer(config.fsRoot, collaborationServer);
  log.debug(`Modules created: fsRoot=${config.fsRoot}`);

  if (config.bootstrapData && config.bootstrapSchemas) {
    modelServer.bootstrap?.({
      dataFile: config.bootstrapData,
      schemasFile: config.bootstrapSchemas
    });
  } else if (config.bootstrapData || config.bootstrapSchemas) {
    log.warn('Both --bootstrap-data and --bootstrap-schemas must be provided for bootstrapping');
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
    fileSystemServer,
    collaborationServer
  };
};
