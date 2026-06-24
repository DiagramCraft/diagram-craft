import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useEntityFacets } from '../hooks/useEntities';
import { FilterDropdown } from './FilterDropdown';
import styles from './EntityFilterPanel.module.css';

export type EntityFilterValue = {
  schemaId: string;
  owner: string;
  lifecycle: string;
};

type Props = {
  value: EntityFilterValue;
  onChange: (update: Partial<EntityFilterValue>) => void;
};

export const EntityFilterPanel = ({ value, onChange }: Props) => {
  const { workspaceSlug, schemas, lifecycleStates } = useWorkspaceContext();
  const { data: facets } = useEntityFacets(workspaceSlug);

  const schemaOptions = [
    { value: '', label: 'Any type' },
    ...(facets?.schema ?? [])
      .sort((a, b) => b.count - a.count)
      .map(s => {
        const schema = schemas.find(sc => sc.id === s.schemaId);
        return { value: s.schemaId, label: schema?.name ?? s.schemaId };
      })
  ];

  const ownerOptions = [
    { value: '', label: 'Any owner' },
    ...(facets?.owner ?? [])
      .filter(o => o.value != null)
      .sort((a, b) => b.count - a.count)
      .map(o => ({ value: o.value!, label: o.label }))
  ];

  const lifecycleOptions = [
    { value: '', label: 'Any status' },
    ...(facets?.lifecycle ?? [])
      .filter(l => l.value != null)
      .sort((a, b) => b.count - a.count)
      .map(l => {
        const state = lifecycleStates.find(s => s.id === l.value);
        return { value: l.value!, label: state?.label ?? l.label };
      })
  ];

  return (
    <div className={styles.cEntityFilterPanel}>
      <FilterDropdown
        label="Type"
        value={value.schemaId}
        onChange={v => onChange({ schemaId: v })}
        options={schemaOptions}
      />
      <FilterDropdown
        label="Owner"
        value={value.owner}
        onChange={v => onChange({ owner: v })}
        options={ownerOptions}
      />
      <FilterDropdown
        label="Status"
        value={value.lifecycle}
        onChange={v => onChange({ lifecycle: v })}
        options={lifecycleOptions}
      />
    </div>
  );
};
