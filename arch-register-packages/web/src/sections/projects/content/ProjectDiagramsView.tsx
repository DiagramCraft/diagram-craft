import type React from 'react';
import {
  DiagramBrowserFolderLabel,
  DiagramBrowserView
} from '../../../components/diagram-browser/DiagramBrowserView';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';

export const ProjectDiagramsView = ({
  project,
  visibleFiles,
  folderFilter,
  filter,
  viewMode,
  onOpenDiagram,
  onOpenMarkdown,
  onDownloadFile,
  onNewDiagram,
  onContextMenu
}: {
  project: ProjectDetailData;
  visibleFiles: ProjectFile[];
  folderFilter: string | null;
  filter: string;
  viewMode: 'grid' | 'list';
  onOpenDiagram: (diagramId: string) => void;
  onOpenMarkdown?: (nodeId: string) => void;
  onDownloadFile?: (file: ProjectFile) => void;
  onNewDiagram?: () => void;
  onContextMenu?: (event: React.MouseEvent, file: ProjectFile) => void;
}) => {
  const lc = filter.toLowerCase();
  const matches = (file: ProjectFile) => !lc || file.name.toLowerCase().includes(lc);

  // Inside a folder only that folder's files are shown; otherwise root files come first, followed
  // by every folder's files.
  const rootFiles = (folderFilter ? visibleFiles : project.files.rootFiles).filter(matches);
  const folderGroups = folderFilter
    ? []
    : project.files.folders
        .map(folder => ({ path: folder.path, files: folder.files.filter(matches) }))
        .filter(group => group.files.length > 0);

  const listItems = [
    ...rootFiles.map(file => ({ file })),
    ...folderGroups.flatMap(group => group.files.map(file => ({ file, folder: group.path })))
  ];

  const gridSections = folderFilter
    ? [
        {
          key: 'folder-filter',
          items: rootFiles.map(file => ({ file })),
          showAddButton: onNewDiagram != null
        }
      ]
    : [
        ...(rootFiles.length > 0 || folderGroups.length === 0
          ? [
              {
                key: 'root-files',
                items: rootFiles.map(file => ({ file })),
                showAddButton: folderGroups.length === 0 && onNewDiagram != null
              }
            ]
          : []),
        ...folderGroups.map((group, index) => ({
          key: group.path,
          label: <DiagramBrowserFolderLabel folder={group.path} />,
          items: group.files.map(file => ({ file, folder: group.path })),
          showAddButton: index === folderGroups.length - 1 && onNewDiagram != null
        }))
      ];

  return (
    <DiagramBrowserView
      hasFilter={filter.length > 0}
      viewMode={viewMode}
      listItems={listItems}
      gridSections={viewMode === 'list' ? [] : gridSections}
      onOpenDiagram={file => onOpenDiagram(file.id)}
      onOpenMarkdown={onOpenMarkdown ? file => onOpenMarkdown(file.id) : undefined}
      onDownloadFile={onDownloadFile}
      onContextMenu={onContextMenu}
      onNewDiagram={onNewDiagram}
      emptyState={{
        title: folderFilter ? 'No diagrams in this folder' : 'No diagrams yet',
        sub: 'Create your first diagram to get started.'
      }}
      noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
    />
  );
};
