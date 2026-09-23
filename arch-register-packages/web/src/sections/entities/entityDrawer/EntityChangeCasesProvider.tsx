import { Chip } from '../../../components/Chip';
import { useChangeCasesByEntity } from '../../../hooks/useChangeCases';
import {
  EntityDrawerProviderStatus,
  type EntityDrawerProviderDefinition,
  type EntityDrawerProviderProps
} from './EntityDrawerProviderRegistry';
import styles from './EntityDrawer.module.css';

const ChangeCasesProvider = ({ context }: EntityDrawerProviderProps) => {
  const cases = useChangeCasesByEntity(context.workspaceId, context.entity._uid, true);
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
      emptyMessage="No change cases linked."
      unavailableMessage="Change cases are unavailable."
    >
      <div className={styles.tags}>
        {items.map(changeCase => (
          <Chip key={changeCase.id} tone="ghost">
            {changeCase.name ?? changeCase.id}
          </Chip>
        ))}
      </div>
    </EntityDrawerProviderStatus>
  );
};

export const entityChangeCasesDrawerProviderDefinitions = [
  {
    slotId: 'entity.change-cases',
    Component: ChangeCasesProvider
  }
] satisfies readonly EntityDrawerProviderDefinition[];
