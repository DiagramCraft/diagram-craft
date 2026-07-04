import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { Project } from '@arch-register/api-types/projectContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { BrowserView } from '@arch-register/api-types/viewContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { ReactNode } from 'react';
import { CardsView } from './CardsView';
import { ExploreView } from './ExploreView';
import { HierarchyView } from './HierarchyView';
import { MatrixView } from './MatrixView';
import { RadarView } from './RadarView';
import { TableView, type TableViewProps } from './TableView';
import { TimelineView } from './TimelineView';
import { TreeView } from './TreeView';
import type { BrowserEntityRecord, ProjectBrowserContext } from './entityBrowserState';

const noopEntityAction = (_entity: EntityRecord) => {};
const noopConfigChange = (_config: unknown) => {};

type EntityBrowserViewProps = {
  view: BrowserView;
  rows: BrowserEntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  projects: Project[];
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  activeViewConfig: unknown;
  onConfigChange?: (config: unknown) => void;
  onEntityClick: (entityId: string) => void;
  onDelete?: (entity: EntityRecord) => void;
  onClone?: (entity: EntityRecord) => void;
  projectContext?: ProjectBrowserContext;
  linkedEntityIds?: string[];
  readOnly?: boolean;
  hideToolbar?: boolean;
  activeDateField?: TableViewProps['activeDateField'];
  selectedIds?: Set<string>;
  onSelectAll?: () => void;
  onSelectRow?: (uid: string) => void;
  unsupportedView?: ReactNode;
};

export const EntityBrowserView = ({
  view,
  rows,
  schemaMap,
  schemas,
  lifecycleStates,
  projects,
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  activeViewConfig,
  onConfigChange = noopConfigChange,
  onEntityClick,
  onDelete = noopEntityAction,
  onClone = noopEntityAction,
  projectContext,
  linkedEntityIds,
  readOnly,
  hideToolbar,
  activeDateField,
  selectedIds,
  onSelectAll,
  onSelectRow,
  unsupportedView = null
}: EntityBrowserViewProps) => {
  switch (view) {
    case 'hierarchy':
      return (
        <HierarchyView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          linkedEntityIds={linkedEntityIds}
          hideToolbar={hideToolbar}
        />
      );
    case 'explore':
      return (
        <ExploreView
          rows={rows}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          linkedEntityIds={linkedEntityIds}
          hideToolbar={hideToolbar}
        />
      );
    case 'matrix':
      return (
        <MatrixView
          rows={rows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          linkedEntityIds={linkedEntityIds}
          hideToolbar={hideToolbar}
        />
      );
    case 'timeline':
      return (
        <TimelineView
          rows={rows}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          workspaceId={workspaceId}
          projects={projects}
          linkedEntityIds={linkedEntityIds}
          hideToolbar={hideToolbar}
        />
      );
    case 'radar':
      return (
        <RadarView
          rows={rows}
          linkedEntityIds={linkedEntityIds}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          hideToolbar={hideToolbar}
        />
      );
    case 'tree':
      return (
        <TreeView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={onDelete}
          onClone={onClone}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
          readOnly={readOnly}
        />
      );
    case 'cards':
      return (
        <CardsView
          rows={rows}
          schemaMap={schemaMap}
          onEntityClick={onEntityClick}
          onDelete={onDelete}
          onClone={onClone}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
          readOnly={readOnly}
        />
      );
    case 'table':
      return (
        <TableView
          rows={rows}
          schemaMap={schemaMap}
          activeDateField={activeDateField}
          onEntityClick={onEntityClick}
          onDelete={onDelete}
          onClone={onClone}
          selectedIds={selectedIds}
          onSelectAll={onSelectAll}
          onSelectRow={onSelectRow}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
          readOnly={readOnly}
        />
      );
    default:
      return unsupportedView;
  }
};
