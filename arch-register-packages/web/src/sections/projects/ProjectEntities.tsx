import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TbCheck, TbDatabase, TbPlus, TbTrash } from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData, ProjectEntity } from '@arch-register/api-types/projectContract';
import { Chip } from '../../components/Chip';
import { TypeBadge } from '../../components/TypeBadge';
import styles from './ProjectDetailScreen.module.css';
import { ProjectMetaItem, ProjectScreenLayout } from './ProjectScreenLayout';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';

export const ProjectEntities = ({
  project,
  projectEntities,
  schemaMap,
  entityTypeColorMap,
  onNavigateHome,
  onNavigateProject,
  onAddEntity,
  onToggleDone,
  onRemoveEntity
}: {
  project: ProjectDetailData;
  projectEntities: ProjectEntity[];
  schemaMap: Map<string, { color: string; icon: string | null }>;
  entityTypeColorMap: Map<string, string>;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onAddEntity: () => void;
  onToggleDone: (entityId: string, isDone: boolean) => void;
  onRemoveEntity: (entityId: string) => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  return (
    <ProjectScreenLayout
      breadcrumbs={[
        { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) },
        { label: 'Projects', onClick: onNavigateHome },
        { label: project.name, onClick: onNavigateProject }
      ]}
      title="Project Entities"
      meta={
        <>
          <ProjectMetaItem
            label="Number of entities"
            value={<span className="mono tabular">{projectEntities.length}</span>}
          />
          <ProjectMetaItem label="Owner" value={project.owner?.name ?? '—'} />
          <ProjectMetaItem label="Last edit" value={new Date(project.updated_at).toLocaleDateString()} />
        </>
      }
      toolbar={
        <div className={styles.tabBar}>
          <div className={styles.sectionLabel} style={{ margin: 0 }}>
            {`Entities (${projectEntities.length})`}
          </div>
          {project.canEdit && (
            <div className={styles.tabBarRight}>
              <Button icon={<TbPlus size={12} />} onClick={onAddEntity}>
                Add entity
              </Button>
            </div>
          )}
        </div>
      }
    >
      <div className={styles.entityTab}>
        {projectEntities.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <TbDatabase size={22} />
            </div>
            <div className={styles.emptyTitle}>No entities linked</div>
            <div className={styles.emptySub}>
              Link entities this project decommissions, modifies, creates, or depends on.
            </div>
            {project.canEdit && (
              <button type="button" className="ar-btn" onClick={onAddEntity}>
                <TbPlus size={11} /> Add entity
              </button>
            )}
          </div>
        ) : (
          <div className={styles.pentTable}>
            <div className={styles.pentHead}>
              <span>Name</span>
              <span>Type</span>
              <span>Role</span>
              <span>Done</span>
            </div>
            {projectEntities.map(entity => {
              const schema = entity.entity_schema ? schemaMap.get(entity.entity_schema.id) : undefined;
              const roleColor = entity.entity_type
                ? entityTypeColorMap.get(entity.entity_type.id)
                : undefined;

              return (
                <div key={entity.entity_id} className={styles.pentRow}>
                  <button type="button" className={styles.pentName}>
                    {schema && <TypeBadge color={schema.color} icon={schema.icon} size={18} />}
                    <div>
                      <div>{entity.entity_name}</div>
                      {entity.entity_description && (
                        <div className={styles.pentNameSub}>{entity.entity_description}</div>
                      )}
                    </div>
                  </button>
                  <span className={styles.pentType}>
                    {entity.entity_schema ? (
                      <Chip tone="ghost">{entity.entity_schema.name}</Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </span>
                  <span className={styles.pentRole}>
                    {entity.entity_type?.name ? (
                      <Chip tone="ghost" dot={roleColor}>
                        {entity.entity_type.name}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </span>
                  <span className={styles.pentActions}>
                    <button
                      type="button"
                      className={`${styles.pentCheck} ${entity.is_done ? styles.pentCheckDone : ''}`}
                      onClick={() => project.canEdit && onToggleDone(entity.entity_id, entity.is_done)}
                      title={entity.is_done ? 'Mark as not done' : 'Mark as done'}
                    >
                      <TbCheck size={11} />
                    </button>
                    {project.canEdit && (
                      <button
                        type="button"
                        className={styles.removeEntityBtn}
                        onClick={() => onRemoveEntity(entity.entity_id)}
                        title="Remove"
                      >
                        <TbTrash size={13} />
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ProjectScreenLayout>
  );
};
