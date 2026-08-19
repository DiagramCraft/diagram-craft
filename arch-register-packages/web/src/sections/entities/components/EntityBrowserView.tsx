import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { BrowserView, FilterCondition } from '@arch-register/api-types/viewContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import type { ReactNode } from 'react';
import { BubbleView } from './BubbleView';
import { CardsView } from './CardsView';
import { EntityBrowserGraphView } from './EntityBrowserGraphView';
import { EntityDiffView } from './EntityDiffView';
import { ExploreView } from './ExploreView';
import { HeatmapView } from './HeatmapView';
import { MapView } from './MapView';
import { MatrixView } from './MatrixView';
import { RadarView } from './RadarView';
import { TableView, type TableViewProps } from './TableView';
import { TimelineView } from './TimelineView';
import { TreeView } from './TreeView';
import { TraceabilityView } from './TraceabilityView';
import type { BrowserEntityRecord, ProjectBrowserContext } from './entityBrowserState';
import type { EntityDisplayField } from './entityDisplayFields';
import type { JoinedAssessmentContext } from './entityFieldSources';

const noopEntityAction = (_entity: EntityRecord) => {};
const noopConfigChange = (_config: unknown) => {};
const noopEntityClick = (_entityId: string) => {};

type EntityBrowserViewData = {
  view: BrowserView;
  rows: BrowserEntityRecord[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams?: WorkspaceTeam[];
  projects: Project[];
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  collectionId?: string | null;
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery | null;
  executionEntityQuery?: EntityQuery | null;
  activeViewConfig: unknown;
  displayFields: EntityDisplayField[];
  projectContext?: ProjectBrowserContext;
  linkedEntityIds?: string[];
  onFocusEntity?: (entityId: string) => void;
  activeDateField?: TableViewProps['activeDateField'];
  unsupportedView?: ReactNode;
  joinAssessmentId?: string | null;
  joinedAssessment?: JoinedAssessmentContext | null;
  responsesByEntity?: Map<string, Record<string, string | number | boolean>>;
  onCountChange?: (count: number) => void;
  diffTargetDate?: string;
  diffIncludePlannedChanges?: boolean;
  diffIncludeOverdueChanges?: boolean;
  isLoading?: boolean;
};

type EntityBrowserViewMode =
  | {
      kind: 'interactive';
      onConfigChange: (config: unknown) => void;
      onEntityClick: (entityId: string) => void;
      onDelete: (entity: EntityRecord) => void;
      onClone: (entity: EntityRecord) => void;
      onManageCollections?: (entity: EntityRecord) => void;
      selectedIds?: Set<string>;
      onSelectAll?: () => void;
      onSelectRow?: (uid: string) => void;
    }
  | {
      kind: 'configure';
      onConfigChange: (config: unknown) => void;
    }
  | {
      kind: 'published';
      onEntityClick: (entityId: string) => void;
    }
  | {
      kind: 'snapshot';
      onConfigChange: (config: unknown) => void;
      onEntityClick: (entityId: string) => void;
    };

export type EntityBrowserViewProps = EntityBrowserViewData & {
  mode: EntityBrowserViewMode;
};

export const EntityBrowserView = ({
  view,
  rows,
  schemaMap,
  schemas,
  relationSchemas,
  lifecycleStates,
  teams,
  projects,
  workspaceId,
  projectId,
  projectScope,
  collectionId,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  conditions,
  entityQuery,
  executionEntityQuery,
  activeViewConfig,
  displayFields,
  projectContext,
  linkedEntityIds,
  onFocusEntity,
  activeDateField,
  unsupportedView = null,
  joinAssessmentId,
  joinedAssessment,
  responsesByEntity,
  onCountChange,
  diffTargetDate,
  diffIncludePlannedChanges,
  diffIncludeOverdueChanges,
  isLoading = false,
  mode
}: EntityBrowserViewProps) => {
  const readOnly = mode.kind !== 'interactive';
  const hideToolbar = mode.kind === 'published';
  const onConfigChange = mode.kind === 'published' ? noopConfigChange : mode.onConfigChange;
  const onEntityClick = mode.kind === 'configure' ? noopEntityClick : mode.onEntityClick;
  const focusEntity = mode.kind === 'interactive' ? onFocusEntity : undefined;
  const onDelete = mode.kind === 'interactive' ? mode.onDelete : noopEntityAction;
  const onClone = mode.kind === 'interactive' ? mode.onClone : noopEntityAction;
  const onManageCollections = mode.kind === 'interactive' ? mode.onManageCollections : undefined;
  const selectedIds = mode.kind === 'interactive' ? mode.selectedIds : undefined;
  const onSelectAll = mode.kind === 'interactive' ? mode.onSelectAll : undefined;
  const onSelectRow = mode.kind === 'interactive' ? mode.onSelectRow : undefined;
  switch (view) {
    case 'graph':
      return (
        <EntityBrowserGraphView
          workspaceId={workspaceId}
          rows={rows}
          schemas={schemas}
          activeViewConfig={activeViewConfig}
          onConfigChange={onConfigChange}
          onEntityClick={onEntityClick}
          isLoading={isLoading}
          hideToolbar={hideToolbar}
          allowActions={mode.kind === 'interactive'}
        />
      );
    case 'diff':
      return (
        <EntityDiffView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          collectionId={collectionId}
          q={q}
          conditions={conditions ?? []}
          entityQuery={entityQuery}
          targetDate={diffTargetDate}
          includePlannedChanges={diffIncludePlannedChanges ?? true}
          includeOverdueChanges={diffIncludeOverdueChanges ?? false}
          schemas={schemas}
          lifecycleStates={lifecycleStates}
          teams={teams ?? []}
        />
      );
    case 'map':
      return (
        <MapView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
          conditions={conditions}
          entityQuery={executionEntityQuery}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          linkedEntityIds={linkedEntityIds}
          hideToolbar={hideToolbar}
          displayFields={displayFields}
          lifecycleStates={lifecycleStates}
          joinAssessmentId={joinAssessmentId}
          joinedAssessment={joinedAssessment}
          onCountChange={onCountChange}
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
          onFocusEntity={focusEntity}
          hideToolbar={hideToolbar}
          displayFields={displayFields}
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
          joinedAssessment={joinedAssessment}
        />
      );
    case 'traceability':
      return (
        <TraceabilityView
          rows={rows}
          rootSchemaIds={
            typeFilter != null ? [typeFilter] : [...new Set(rows.map(row => row._schema.id))]
          }
          schemas={schemas}
          relationSchemas={relationSchemas}
          projects={projects}
          workspaceId={workspaceId}
          projectId={projectId}
          executionEntityQuery={executionEntityQuery}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          onEntityClick={onEntityClick}
          hideToolbar={hideToolbar}
          isLoading={isLoading}
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
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          entityQuery={executionEntityQuery}
          typeFilter={typeFilter}
          ownerFilter={ownerFilter}
          statusFilter={statusFilter}
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
          joinedAssessment={joinedAssessment}
        />
      );
    case 'bubble':
      return (
        <BubbleView
          rows={rows}
          linkedEntityIds={linkedEntityIds}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          hideToolbar={hideToolbar}
          joinedAssessment={joinedAssessment}
        />
      );
    case 'heatmap':
      return (
        <HeatmapView
          rows={rows}
          linkedEntityIds={linkedEntityIds}
          onEntityClick={onEntityClick}
          config={activeViewConfig}
          onConfigChange={onConfigChange}
          hideToolbar={hideToolbar}
          joinedAssessment={joinedAssessment}
        />
      );
    case 'tree':
      return (
        <TreeView
          workspaceId={workspaceId}
          projectId={projectId}
          projectScope={projectScope}
          q={q}
          entityQuery={executionEntityQuery}
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
          config={activeViewConfig}
          displayFields={displayFields}
          joinAssessmentId={joinAssessmentId}
          responsesByEntity={responsesByEntity}
          onCountChange={onCountChange}
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
          onManageCollections={onManageCollections}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
          readOnly={readOnly}
          config={activeViewConfig}
          displayFields={displayFields}
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
          onManageCollections={onManageCollections}
          selectedIds={selectedIds}
          onSelectAll={onSelectAll}
          onSelectRow={onSelectRow}
          lifecycleStates={lifecycleStates}
          projectContext={projectContext}
          readOnly={readOnly}
          config={activeViewConfig}
          displayFields={displayFields}
        />
      );
    default:
      return unsupportedView;
  }
};
