import type { EntityLandscapeDiff } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '@arch-register/api-types/workspaceConfigContract';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { EmptyState } from '../../components/EmptyState';
import { EntityLandscapeDiffTable } from '../entities/components/EntityLandscapeDiffTable';
import { formatDate } from '../../utils/dateFormat';
import styles from './ProjectChangesSummaryTab.module.css';

type SchemaInfo = { color: string; icon: string | null };

export const ProjectChangesSummaryTab = ({
  diff,
  isLoading,
  targetDate,
  schemaMap,
  schemas,
  lifecycleStates,
  teams,
  includeOverdueChanges,
  onIncludeOverdueChangesChange
}: {
  diff: EntityLandscapeDiff | undefined;
  isLoading: boolean;
  targetDate: string | null;
  schemaMap: Map<string, SchemaInfo>;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  includeOverdueChanges: boolean;
  onIncludeOverdueChangesChange: (include: boolean) => void;
}) => {
  if (!targetDate) {
    return (
      <div className={styles.wrap}>
        <EmptyState
          title="No planned changes"
          subtitle="This project has no dated planned changes to compare against the current state."
        />
      </div>
    );
  }

  if (isLoading || !diff) {
    return <div className={styles.wrap}>Loading…</div>;
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>What&apos;s changed by {formatDate(targetDate)}</div>
        <div className={styles.headerCounts}>
          {diff.added.length} added &middot; {diff.removed.length} removed &middot;{' '}
          {diff.changed.length} changed
        </div>
        <label className={styles.overdueToggle}>
          <Checkbox
            value={includeOverdueChanges}
            onChange={v => onIncludeOverdueChangesChange(v ?? false)}
          />
          <span>Overdue changes</span>
        </label>
      </div>

      <EntityLandscapeDiffTable
        diff={diff}
        schemaMap={schemaMap}
        schemas={schemas}
        lifecycleStates={lifecycleStates}
        teams={teams}
      />
    </div>
  );
};
