// biome-ignore lint/correctness/noUndeclaredDependencies: this is a vite alias
import defineAppConfig from '@diagram-craft/config';
import { defaultAppConfig } from './appConfig.default';
import { createDiagramCraft } from './embed/createDiagramCraft';

export const diagramCraft = createDiagramCraft({ appConfig: defineAppConfig(defaultAppConfig) });
