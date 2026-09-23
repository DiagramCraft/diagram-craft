import { dueLabel } from '../../../utils/assessmentDueTone';
import { caseKindLabel } from '../../../utils/governanceCaseLabels';
import { useGovernanceCases } from '../../../hooks/useGovernance';
import { Chip } from '../../../components/Chip';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from './EntityDrawerProviderRegistry';
import styles from './EntityDrawer.module.css';

const GovernanceItemsProvider = ({ context }: EntityDrawerProviderProps) => {
  const cases = useGovernanceCases(context.workspaceId, {
    status: 'open',
    subjectType: 'entity',
    subjectId: context.entity._uid
  });
  const items = cases.data ?? [];
  const state = cases.isLoading
    ? 'loading'
    : cases.isError
      ? 'unavailable'
      : items.length > 0
        ? 'ready'
        : 'empty';

  return (
    <EntityDrawerProviderStatus
      state={state}
      emptyMessage="No open governance items."
      unavailableMessage="Governance items are unavailable."
    >
      <div className={styles.tags}>
        {items.map(governanceCase => {
          const content = (
            <Chip key={governanceCase.id} tone="ghost">
              {caseKindLabel(governanceCase.caseKind, governanceCase.payload)}
              <span className="dim" style={{ marginLeft: 4 }}>
                due {dueLabel(governanceCase.dueAt)}
              </span>
            </Chip>
          );

          return context.openGovernanceCase ? (
            <button
              key={governanceCase.id}
              type="button"
              className={styles.attributeRow}
              style={{
                width: '100%',
                border: 0,
                background: 'none',
                cursor: 'pointer',
                textAlign: 'left'
              }}
              onClick={() => context.openGovernanceCase?.(governanceCase.id)}
            >
              {content}
            </button>
          ) : (
            content
          );
        })}
      </div>
    </EntityDrawerProviderStatus>
  );
};

export const entityGovernanceItemsDrawerProviderDefinitions = [
  {
    slotId: 'entity.governance-items',
    Component: GovernanceItemsProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
