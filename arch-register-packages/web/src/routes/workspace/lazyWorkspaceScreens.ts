import { lazyRouteComponent } from '@tanstack/react-router';

export const LazyProjectsScreen = lazyRouteComponent(
  () => import('../../sections/projects/ProjectsScreen'),
  'ProjectsScreen'
);
export const LazyProjectDetailScreen = lazyRouteComponent(
  () => import('../../sections/projects/ProjectDetailScreen'),
  'ProjectDetailScreen'
);
export const LazyDiagramScreen = lazyRouteComponent(
  () => import('../../sections/projects/DiagramScreen'),
  'DiagramScreen'
);
export const LazyMarkdownEditorScreen = lazyRouteComponent(
  () => import('../../sections/markdown/MarkdownEditorScreen'),
  'MarkdownEditorScreen'
);
export const LazyWorkspaceContentRoute = lazyRouteComponent(
  () => import('./WorkspaceContentRoute'),
  'WorkspaceContentRoute'
);
export const LazyEntityBrowserScreen = lazyRouteComponent(
  () => import('../../sections/entities/EntityBrowserScreen'),
  'EntityBrowserScreen'
);
export const LazyEntityDetailScreen = lazyRouteComponent(
  () => import('../../sections/entities/EntityDetailScreen'),
  'EntityDetailScreen'
);
export const LazyImportScreen = lazyRouteComponent(
  () => import('../../sections/entities/ImportScreen'),
  'ImportScreen'
);
export const LazyAssistantScreen = lazyRouteComponent(
  () => import('../../sections/ai-assistant/AssistantScreen'),
  'AssistantScreen'
);
export const LazyExtractScreen = lazyRouteComponent(
  () => import('../../sections/ai-extract/ExtractScreen'),
  'ExtractScreen'
);
export const LazySearchScreen = lazyRouteComponent(
  () => import('../../sections/search/SearchScreen'),
  'SearchScreen'
);
export const LazyWorkspaceSettingsScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/WorkspaceSettingsScreen'),
  'WorkspaceSettingsScreen'
);
export const LazySchemaSettingsScreen = lazyRouteComponent(
  () => import('../../sections/workspace-settings/SchemaSettingsScreen'),
  'SchemaSettingsScreen'
);
export const LazySchemaGraphView = lazyRouteComponent(
  () => import('../../sections/workspace-settings/SchemaGraphView'),
  'SchemaGraphView'
);
export const LazyGlobalSettingsScreen = lazyRouteComponent(
  () => import('../../sections/global-settings/GlobalSettingsScreen'),
  'GlobalSettingsScreen'
);
export const LazyAccountSettingsScreen = lazyRouteComponent(
  () => import('../../sections/account-settings/AccountSettingsScreen'),
  'AccountSettingsScreen'
);
