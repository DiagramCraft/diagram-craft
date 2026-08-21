import { Button } from '@diagram-craft/app-components/Button';
import { Popover } from '@diagram-craft/app-components/Popover';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { groupSchemasByCategory } from '../../lib/schemaPresentation';
import type { EntityCategoryState, EntityCategoryStates } from './schemaGraphState';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import styles from './SchemaGraphView.module.css';

type Props = {
  schemas: EntitySchema[];
  categoryStates: EntityCategoryStates;
  onChange: (category: string, state: EntityCategoryState | 'visible') => void;
};

export const CategoryVisibilityPopover = ({ schemas, categoryStates, onChange }: Props) => {
  const groups = groupSchemasByCategory(schemas);
  const nonVisibleCount = categoryStates.size;

  return (
    <Popover.Root>
      <Popover.Trigger
        element={
          <Button size="sm" variant="secondary" data-testid="model-overview-categories">
            Categories{nonVisibleCount > 0 ? ` (${nonVisibleCount})` : ''}
          </Button>
        }
      />
      <Popover.Content
        sideOffset={4}
        align="start"
        arrow={false}
        closeButton={false}
        className={styles.categoryPopover}
      >
        {groups.map(group => (
          <div key={group.category} className={styles.categoryRow}>
            <span className={styles.categoryRowLabel}>
              {group.category} ({group.items.length})
            </span>
            <ToggleButtonGroup.Root
              type="single"
              aria-label={`${group.category} visibility`}
              value={categoryStates.get(group.category) ?? 'visible'}
              onChange={value => {
                if (value) onChange(group.category, value as EntityCategoryState | 'visible');
              }}
            >
              <ToggleButtonGroup.Item value="visible">Visible</ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value="collapsed">Collapsed</ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value="hidden">Hidden</ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
        ))}
      </Popover.Content>
    </Popover.Root>
  );
};
