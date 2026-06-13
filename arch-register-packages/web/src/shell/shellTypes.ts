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
  | 'search'
  | 'assistant'
  | 'extract';
