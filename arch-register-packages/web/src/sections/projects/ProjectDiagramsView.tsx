import type React from 'react';
import {
  DiagramBrowserFolderLabel,
  DiagramBrowserView
} from '../../components/diagram-browser/DiagramBrowserView';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { FileEntry } from '../../lib/api';

export type ProjectMenuTarget =
  | { type: 'diagram'; file: FileEntry }
  | { type: 'markdown'; file: FileEntry }
  | { type: 'folder'; path: string };

export const ProjectDiagramsView = ({
  project,
  visibleFiles,
  folderFilter,
  filter,
  viewMode,
  onOpenDiagram,
  onOpenMarkdown,
  onNewDiagram,
  onContextMenu
}: {
  project: ProjectDetailData;
  visibleFiles: FileEntry[];
  folderFilter: string | null;
  filter: string;
  viewMode: 'grid' | 'list';
  onOpenDiagram: (diagramId: string) => void;
  onOpenMarkdown?: (nodeId: string) => void;
  onNewDiagram?: () => void;
  onContextMenu?: (e: React.MouseEvent, target: ProjectMenuTarget) => void;
}) => {
  const lc = filter.toLowerCase();
  const filtered = lc ? visibleFiles.filter(f => f.name.toLowerCase().includes(lc)) : visibleFiles;

  if (viewMode === 'list') {
    const allItems: Array<{ file: FileEntry; folder?: string }> = folderFilter
      ? filtered.map(file => ({ file }))
      : [
          ...project.files.rootFiles
            .filter(file => !lc || file.name.toLowerCase().includes(lc))
            .map(file => ({ file })),
          ...project.files.folders.flatMap(folder =>
            folder.files
              .filter(file => !lc || file.name.toLowerCase().includes(lc))
              .map(file => ({ file, folder: folder.path }))
          )
        ];

    return (
      <DiagramBrowserView
        hasFilter={filter.length > 0}
        viewMode={viewMode}
        listItems={allItems}
        gridSections={[]}
        onOpenDiagram={file => onOpenDiagram(file.id)}
        onOpenMarkdown={onOpenMarkdown ? file => onOpenMarkdown(file.id) : undefined}
        onContextMenu={
          onContextMenu
            ? (event, file) =>
                onContextMenu(event, { type: file.type === 'markdown' ? 'markdown' : 'diagram', file })
            : undefined
        }
        onNewDiagram={onNewDiagram}
        emptyState={{
          title: folderFilter ? 'No diagrams in this folder' : 'No diagrams yet',
          sub: 'Create your first diagram to get started.'
        }}
        noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
      />
    );
  }

  if (folderFilter) {
    return (
      <DiagramBrowserView
        hasFilter={filter.length > 0}
        viewMode={viewMode}
        listItems={filtered.map(file => ({ file }))}
        gridSections={[
          {
            key: 'folder-filter',
            items: filtered.map(file => ({ file })),
            showAddButton: onNewDiagram != null
          }
        ]}
        onOpenDiagram={file => onOpenDiagram(file.id)}
        onOpenMarkdown={onOpenMarkdown ? file => onOpenMarkdown(file.id) : undefined}
        onContextMenu={
          onContextMenu
            ? (event, file) =>
                onContextMenu(event, { type: file.type === 'markdown' ? 'markdown' : 'diagram', file })
            : undefined
        }
        onNewDiagram={onNewDiagram}
        emptyState={{
          title: 'No diagrams in this folder',
          sub: 'Create your first diagram to get started.'
        }}
        noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
      />
    );
  }

  const rootFiles = project.files.rootFiles.filter(file => !lc || file.name.toLowerCase().includes(lc));

  const folderGroups = project.files.folders
    .map(folder => ({
      path: folder.path,
      files: folder.files.filter(file => !lc || file.name.toLowerCase().includes(lc))
    }))
    .filter(group => group.files.length > 0);

  const gridSections = [
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
      listItems={[
        ...rootFiles.map(file => ({ file })),
        ...folderGroups.flatMap(group => group.files.map(file => ({ file, folder: group.path })))
      ]}
      gridSections={gridSections}
      onOpenDiagram={file => onOpenDiagram(file.id)}
      onOpenMarkdown={onOpenMarkdown ? file => onOpenMarkdown(file.id) : undefined}
      onContextMenu={
        onContextMenu
          ? (event, file) =>
              onContextMenu(event, { type: file.type === 'markdown' ? 'markdown' : 'diagram', file })
          : undefined
      }
      onNewDiagram={onNewDiagram}
      emptyState={{ title: 'No diagrams yet', sub: 'Create your first diagram to get started.' }}
      noMatchState={{ title: 'No matches', sub: `No diagrams match "${filter}".` }}
    />
  );
};
