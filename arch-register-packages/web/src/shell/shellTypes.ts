import type { AppRailItemId } from './appShellRegistry';

export type BreadcrumbItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

export type WorkspaceRailItemId =
  | 'home'
  | 'content'
  | 'projects'
  | 'entities'
  | AppRailItemId
  | 'search'
  | 'governance'
  | 'assistant'
  | 'extract';
