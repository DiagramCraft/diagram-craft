// biome-ignore lint/correctness/noUndeclaredDependencies: this is a vite alias
import defineAppConfig from '@diagram-craft/config';
import { defaultAppConfig } from './appConfig.default';
import { bootstrapDiagramCraft } from './embed/bootstrapDiagramCraft';

export const diagramCraft = bootstrapDiagramCraft({ appConfig: defineAppConfig(defaultAppConfig) });
