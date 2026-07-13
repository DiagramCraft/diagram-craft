import { useState, useMemo } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import styles from './EntityDependentsTab.module.css';
import { TypeBadge } from '../../../components/TypeBadge';
import { StatusChip } from '../../../components/StatusChip';
import { Chip } from '../../../components/Chip';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { useEntityDependents } from '../../../hooks/useEntities';
import { EmptyState } from '../../../components/EmptyState';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { EntityDependent } from '@arch-register/api-types/entityContract';

type Props = {
  workspaceId: string;
  entityId: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  onEntityClick: (publicId: string) => void;
};

export const EntityDependentsTab = ({
  workspaceId,
  entityId,
  schemas,
  lifecycleStates,
  onEntityClick
}: Props) => {
  const [transitive, setTransitive] = useState(false);
  const [schemaFilter, setSchemaFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');

  const { data, isLoading } = useEntityDependents(workspaceId, entityId, transitive);
  const dependents = data?.dependents ?? [];
  const truncated = data?.truncated ?? false;

  const schemaOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const d of dependents) unique.set(d.entitySchemaId, d.schemaName);
    return [
      { value: 'all', label: 'All types' },
      ...Array.from(unique.entries()).map(([id, name]) => ({ value: id, label: name }))
    ];
  }, [dependents]);

  const lifecycleOptions = useMemo(() => {
    const unique = new Set(dependents.map(d => d.lifecycleState).filter(Boolean) as string[]);
    return [
      { value: 'all', label: 'All states' },
      ...Array.from(unique).map(id => ({
        value: id,
        label: lifecycleStates.find(s => s.id === id)?.label ?? id
      }))
    ];
  }, [dependents, lifecycleStates]);

  const filtered = useMemo(
    () =>
      dependents.filter(
        d =>
          (schemaFilter === 'all' || d.entitySchemaId === schemaFilter) &&
          (lifecycleFilter === 'all' || d.lifecycleState === lifecycleFilter)
      ),
    [dependents, schemaFilter, lifecycleFilter]
  );

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.dim}>Loading…</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <FilterDropdown
          label="Scope"
          value={transitive ? 'transitive' : 'direct'}
          onChange={v => setTransitive(v === 'transitive')}
          options={[
            { value: 'direct', label: 'Direct only' },
            { value: 'transitive', label: 'All dependents' }
          ]}
        />
        {schemaOptions.length > 2 && (
          <FilterDropdown
            label="Type"
            value={schemaFilter}
            onChange={setSchemaFilter}
            options={schemaOptions}
          />
        )}
        {lifecycleOptions.length > 2 && (
          <FilterDropdown
            label="State"
            value={lifecycleFilter}
            onChange={setLifecycleFilter}
            options={lifecycleOptions}
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No dependents"
          subtitle={`No entities reference this one${transitive ? ' (directly or transitively)' : ' directly'}.`}
        />
      ) : (
        <>
          <div className={styles.list}>
            {filtered.map((dep, i) => (
              <DependentRow
                key={`${dep.entityId}-${i}`}
                dependent={dep}
                schemas={schemas}
                lifecycleStates={lifecycleStates}
                showDepth={transitive}
                onEntityClick={onEntityClick}
              />
            ))}
          </div>
          {truncated && (
            <div className={styles.truncatedNotice}>
              Results truncated — refine filters or reduce scope to see more.
            </div>
          )}
        </>
      )}
    </div>
  );
};

const DependentRow = ({
  dependent,
  schemas,
  lifecycleStates,
  showDepth,
  onEntityClick
}: {
  dependent: EntityDependent;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  showDepth: boolean;
  onEntityClick: (publicId: string) => void;
}) => {
  const schemaIdx = schemas.findIndex(s => s.id === dependent.entitySchemaId);
  const schema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const color = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';
  const indent = showDepth ? (dependent.depth - 1) * 20 : 0;

  return (
    <button
      type="button"
      className={styles.row}
      onClick={() => onEntityClick(dependent.publicId)}
    >
      {indent > 0 && <span className={styles.rowIndent} style={{ width: indent }} />}
      <span className={styles.rowLead}>
        <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
        <span className={styles.rowName}>{dependent.entityName}</span>
        <TbChevronRight size={10} className={styles.dim} />
        <Chip tone="ghost">{getRelationDisplayLabel(dependent)}</Chip>
      </span>
      <span className={styles.rowMeta}>
        {dependent.lifecycleState && (
          <StatusChip value={dependent.lifecycleState} lifecycleStates={lifecycleStates} />
        )}
      </span>
    </button>
  );
};
