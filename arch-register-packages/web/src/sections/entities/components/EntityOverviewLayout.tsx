import type { Dispatch, SetStateAction } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type {
  DetailLayoutConfig,
  EntitySchema,
  LayoutPanel,
  LayoutTab
} from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  SupportedCurrency,
  WorkspaceTeam
} from '@arch-register/api-types/workspaceConfigContract';
import type { Project } from '@arch-register/api-types/projectCrudContract';
import type {
  ProjectEntity,
  DiagramEntityFile
} from '@arch-register/api-types/projectEntityContract';
import type { RefLookup } from '../types/entityDetailTypes';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { TypedRelationEditState } from '../../../lib/entityEditState';
import styles from './EntityOverviewTab.module.css';
import { EntityDetailAccordion } from './EntityDetailAccordion';
import { MetadataBlock } from './MetadataBlock';
import { LinksBlock } from './LinksBlock';
import { UnboundTypedRelationBlock } from './UnboundTypedRelationBlock';
import { ProjectsBlock } from './ProjectsBlock';
import { DiagramsBlock } from './DiagramsBlock';
import { useEntityFieldRenderers } from './useEntityFieldRenderers';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { resolveGroupAccessControl } from '../../../lib/fieldGroupAccess';
import { computeUnboundRelationEndpoints } from '../../../lib/unboundTypedRelations';

type EntityProjectAssoc = { project: Project; entity_type: ProjectEntity['entity_type'] };

type Props = {
  workspaceSlug: string;
  entity: EntityRecord;
  schema: EntitySchema | null;
  layout: DetailLayoutConfig;
  editing: boolean;
  editState: Record<string, unknown>;
  setEditState: Dispatch<SetStateAction<Record<string, unknown>>>;
  typedRelationEditState: TypedRelationEditState;
  setTypedRelationEditState: Dispatch<SetStateAction<TypedRelationEditState>>;
  editLinks: EntitySummary['_links'];
  setEditLinks: Dispatch<SetStateAction<EntitySummary['_links']>>;
  validationErrors: Set<string>;
  setValidationErrors: Dispatch<SetStateAction<Set<string>>>;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  currencies: SupportedCurrency[];
  defaultCurrency: string;
  entityProjects: EntityProjectAssoc[];
  entityDiagramFiles: DiagramEntityFile[];
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
};

export const EntityOverviewLayout = ({
  workspaceSlug,
  entity,
  schema,
  layout,
  editing,
  editState,
  setEditState,
  typedRelationEditState,
  setTypedRelationEditState,
  editLinks,
  setEditLinks,
  validationErrors,
  setValidationErrors,
  refLookup,
  referenceOptions,
  teams,
  lifecycleStates,
  currencies,
  defaultCurrency,
  entityProjects,
  entityDiagramFiles,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas
}: Props) => {
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceSlug);
  const {
    renderPropertyRow,
    getTypedRelationFieldState,
    unboundRelationFieldId,
    updateUnboundTypedRelation
  } = useEntityFieldRenderers({
    workspaceSlug,
    entity,
    editing,
    editState,
    setEditState,
    typedRelationEditState,
    setTypedRelationEditState,
    validationErrors,
    setValidationErrors,
    refLookup,
    referenceOptions,
    currencies,
    defaultCurrency,
    typedRelationsOutgoing,
    typedRelationsIncoming,
    relationSchemas
  });

  const fieldsById = new Map((schema?.fields ?? []).map(field => [field.id, field]));
  const groupsById = new Map((schema?.groups ?? []).map(group => [group.id, group]));
  const relationSchemasById = new Map(relationSchemas.map(rs => [rs.id, rs]));

  const panelCount = (panel: LayoutPanel): number | undefined => {
    if (panel.blocks.length !== 1) return undefined;
    const block = panel.blocks[0]!;
    if (block.kind === 'links') {
      return editing
        ? editLinks.filter(link => link.url.trim() !== '').length
        : entity._links.length;
    }
    if (block.kind === 'unboundTypedRelation' && block.refId) {
      const relationSchema = relationSchemasById.get(block.refId);
      if (!relationSchema) return undefined;
      return computeUnboundRelationEndpoints(
        schema,
        relationSchema,
        typedRelationsOutgoing,
        typedRelationsIncoming
      ).reduce((count, endpoint) => count + endpoint.records.length, 0);
    }
    if (block.kind === 'projects') return entityProjects.length;
    if (block.kind === 'diagrams') return entityDiagramFiles.length;
    return undefined;
  };

  const renderBlockContent = (panel: LayoutPanel) =>
    panel.blocks.flatMap(block => {
      if (block.kind === 'field') {
        const field = block.refId ? fieldsById.get(block.refId) : undefined;
        if (!field) return [];
        return [renderPropertyRow(field)];
      }
      if (block.kind === 'fieldGroup') {
        const group = block.refId ? groupsById.get(block.refId) : undefined;
        if (!group) return [];
        const access = getFieldGroupAccess(
          resolveGroupAccessControl(group, schema?.shared_field_group_links ?? [])
        );
        if (access === 'none') return [];
        const groupFields = (schema?.fields ?? []).filter(field => field.groupId === group.id);
        if (groupFields.length === 0) return [];
        return [
          <div key={block.id}>
            {group.description && (
              <div className={styles.groupDescription}>{group.description}</div>
            )}
            <div className={styles.propList}>
              {groupFields.map(field => renderPropertyRow(field, access))}
            </div>
          </div>
        ];
      }
      if (block.kind === 'metadata') {
        if (!block.refId) return [];
        return [
          <MetadataBlock
            key={block.id}
            slot={block.refId as never}
            entity={entity}
            editing={editing}
            editState={editState}
            setEditState={setEditState}
            teams={teams}
            lifecycleStates={lifecycleStates}
          />
        ];
      }
      if (block.kind === 'links') {
        return [
          <LinksBlock
            key={block.id}
            entity={entity}
            editing={editing}
            editLinks={editLinks}
            setEditLinks={setEditLinks}
          />
        ];
      }
      if (block.kind === 'unboundTypedRelation') {
        const relationSchema = block.refId ? relationSchemasById.get(block.refId) : undefined;
        if (!relationSchema) return [];
        return [
          <UnboundTypedRelationBlock
            key={block.id}
            schema={schema}
            relationSchema={relationSchema}
            editing={editing}
            workspaceSlug={workspaceSlug}
            typedRelationsOutgoing={typedRelationsOutgoing}
            typedRelationsIncoming={typedRelationsIncoming}
            unboundRelationFieldId={unboundRelationFieldId}
            getTypedRelationFieldState={getTypedRelationFieldState}
            updateUnboundTypedRelation={updateUnboundTypedRelation}
          />
        ];
      }
      if (block.kind === 'projects') {
        return [<ProjectsBlock key={block.id} entityProjects={entityProjects} />];
      }
      if (block.kind === 'diagrams') {
        return [
          <DiagramsBlock
            key={block.id}
            workspaceSlug={workspaceSlug}
            entityDiagramFiles={entityDiagramFiles}
          />
        ];
      }
      return [];
    });

  const nonEmptyPanels = (panels: LayoutPanel[]) =>
    panels.filter(panel => {
      if (panel.blocks.length === 0) return false;
      const soleBlock = panel.blocks.length === 1 ? panel.blocks[0]! : undefined;
      if (soleBlock?.kind === 'fieldGroup') {
        const group = soleBlock.refId ? groupsById.get(soleBlock.refId) : undefined;
        if (!group) return false;
        const access = getFieldGroupAccess(
          resolveGroupAccessControl(group, schema?.shared_field_group_links ?? [])
        );
        if (access === 'none') return false;
      }
      return true;
    });

  const renderPlainPanels = (panels: LayoutPanel[]) => {
    let sawPanel = false;
    return panels.map(panel => {
      const divider = sawPanel;
      sawPanel = true;
      return (
        <div key={panel.id}>
          {divider && <hr className={styles.divider} />}
          <div className={styles.sectionLabel}>{panel.title}</div>
          {renderBlockContent(panel)}
        </div>
      );
    });
  };

  const renderAccordionPanels = (panels: LayoutPanel[]) =>
    panels.map(panel => (
      <EntityDetailAccordion.Section
        key={panel.id}
        value={panel.id}
        title={panel.title}
        count={panelCount(panel)}
      >
        {renderBlockContent(panel)}
      </EntityDetailAccordion.Section>
    ));

  const renderColumn = (panels: LayoutPanel[], className: string | undefined) => {
    const visible = nonEmptyPanels(panels);
    const plainPanels = visible.filter(panel => panel.collapsible === false);
    const accordionPanels = visible.filter(panel => panel.collapsible !== false);

    return (
      <div className={className}>
        {renderPlainPanels(plainPanels)}
        {accordionPanels.length > 0 && (
          <div style={plainPanels.length > 0 ? { marginTop: 12 } : undefined}>
            <EntityDetailAccordion defaultOpen={['metadata']}>
              {renderAccordionPanels(accordionPanels)}
            </EntityDetailAccordion>
          </div>
        )}
      </div>
    );
  };

  const renderTabContent = (tab: LayoutTab) => {
    if (tab.columns === 2) {
      const column1 = tab.panels.filter(panel => panel.column !== 2);
      const column2 = tab.panels.filter(panel => panel.column === 2);
      return (
        <div className={styles.overviewGrid}>
          {renderColumn(column1, styles.propsPanel)}
          {renderColumn(column2, styles.sidePanel)}
        </div>
      );
    }
    return (
      <div className={styles.layoutColumn}>{renderColumn(tab.panels, styles.layoutPanel)}</div>
    );
  };

  if (layout.tabs.length <= 1) {
    return layout.tabs[0] ? renderTabContent(layout.tabs[0]) : null;
  }

  return (
    <Tabs.Root defaultValue={layout.tabs[0]!.id}>
      <Tabs.List>
        {layout.tabs.map(tab => (
          <Tabs.Trigger key={tab.id} value={tab.id}>
            {tab.title}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {layout.tabs.map(tab => (
        <Tabs.Content key={tab.id} value={tab.id}>
          {renderTabContent(tab)}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};
