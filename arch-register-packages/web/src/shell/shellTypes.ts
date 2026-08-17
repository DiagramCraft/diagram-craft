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
  | 'glossary'
  | 'search'
  | 'governance'
  | 'assistant'
  | 'extract';
