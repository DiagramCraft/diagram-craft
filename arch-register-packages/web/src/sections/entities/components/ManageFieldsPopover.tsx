import { useRef } from 'react';
import { TbColumns3 } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntityDisplayField } from './entityDisplayFields';
import styles from './EntityBrowser.module.css';

export const ManageFieldsPopover = ({
  fields,
  selectedIds,
  onChange,
  onReset,
  disabled = false
}: {
  fields: EntityDisplayField[];
  selectedIds: string[];
  onChange: (fieldIds: string[]) => void;
  onReset?: () => void;
  disabled?: boolean;
}) => {
  const actionsRef = useRef<PopoverActions | null>(null);
  const groups = new Map<string, EntityDisplayField[]>();
  for (const field of fields) groups.set(field.group, [...(groups.get(field.group) ?? []), field]);
  return (
    <Popover.Root actionsRef={actionsRef}>
      <Popover.Trigger
        element={
          <Button
            size="sm"
            variant="secondary"
            icon={<TbColumns3 size={12} />}
            aria-label="Manage fields"
            title="Manage fields"
            disabled={disabled}
          />
        }
      />
      <Popover.Content
        sideOffset={4}
        align="end"
        arrow={false}
        closeButton={false}
        className={styles.fieldsPopover}
      >
        {[...groups].map(([group, options]) => (
          <div key={group} className={styles.fieldsGroup}>
            <div className={styles.fieldsGroupLabel}>{group}</div>
            {options.map(field => (
              <label key={field.id} className={styles.fieldsOption}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(field.id)}
                  onChange={() =>
                    onChange(
                      selectedIds.includes(field.id)
                        ? selectedIds.filter(id => id !== field.id)
                        : [...selectedIds, field.id]
                    )
                  }
                />
                {field.label}
              </label>
            ))}
          </div>
        ))}
        {onReset && (
          <div className={styles.fieldsFooter}>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                onReset();
                actionsRef.current?.close();
              }}
            >
              Reset to defaults
            </Button>
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  );
};
