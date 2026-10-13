import { useRef, useState } from 'react';
import { TbColumns3, TbSettings } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { ColumnRenderConfig } from '@arch-register/api-types/viewContract';
import { ColumnRendererEditor } from './ColumnRendererEditor';
import { hasColumnRendererChoice } from './columnRenderers';
import type { EntityDisplayField } from './entityDisplayFields';
import styles from './EntityBrowser.module.css';

export const ManageFieldsPopover = ({
  fields,
  selectedIds,
  onChange,
  onReset,
  columnRenderers,
  onColumnRenderersChange,
  disabled = false
}: {
  fields: EntityDisplayField[];
  selectedIds: string[];
  onChange: (fieldIds: string[]) => void;
  onReset?: () => void;
  /** Table view only: per-column renderers keyed by field id, and their setter. */
  columnRenderers?: Record<string, ColumnRenderConfig>;
  onColumnRenderersChange?: (columnRenderers: Record<string, ColumnRenderConfig>) => void;
  disabled?: boolean;
}) => {
  const actionsRef = useRef<PopoverActions | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) =>
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
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
              <div key={field.id}>
                <div className={styles.fieldsRow}>
                  <label className={styles.fieldsOption}>
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
                  {onColumnRenderersChange &&
                    selectedIds.includes(field.id) &&
                    hasColumnRendererChoice(field) && (
                      <button
                        type="button"
                        className={styles.fieldsConfigure}
                        data-active={(columnRenderers?.[field.id]?.type ?? 'plain') !== 'plain'}
                        aria-label={`Configure ${field.label} rendering`}
                        aria-expanded={expandedIds.has(field.id)}
                        title="Configure rendering"
                        onClick={() => toggleExpanded(field.id)}
                      >
                        <TbSettings size={13} />
                      </button>
                    )}
                </div>
                {onColumnRenderersChange &&
                  selectedIds.includes(field.id) &&
                  hasColumnRendererChoice(field) &&
                  expandedIds.has(field.id) && (
                    <ColumnRendererEditor
                      field={field}
                      config={columnRenderers?.[field.id] ?? { type: 'plain' }}
                      onChange={next => {
                        const { [field.id]: _removed, ...others } = columnRenderers ?? {};
                        onColumnRenderersChange(
                          next.type === 'plain' ? others : { ...others, [field.id]: next }
                        );
                      }}
                    />
                  )}
              </div>
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
