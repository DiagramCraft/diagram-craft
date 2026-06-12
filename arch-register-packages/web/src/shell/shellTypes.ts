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
  | 'model'
  | 'search'
  | 'assistant'
  | 'extract';
