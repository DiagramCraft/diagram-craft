import { TbCheck, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { WorkspaceTeam } from '../../../lib/api';
import styles from '../EntityBrowserScreen.module.css';

export type BulkEditToolbarProps = {
  selectedIds: Set<string>;
  bulkConfirming: boolean;
  setBulkConfirming: (value: boolean) => void;
  bulkLifecycleValue: string;
  setBulkLifecycleValue: (value: string) => void;
  bulkOwnerValue: string;
  setBulkOwnerValue: (value: string) => void;
  lifecycleStates: WorkspaceLifecycleState[];
  teams: WorkspaceTeam[];
  onClear: () => void;
  onConfirm: () => void;
};

export const BulkEditToolbar = ({
  selectedIds,
  bulkConfirming,
  setBulkConfirming,
  bulkLifecycleValue,
  setBulkLifecycleValue,
  bulkOwnerValue,
  setBulkOwnerValue,
  lifecycleStates,
  teams,
  onClear,
  onConfirm
}: BulkEditToolbarProps) => (
  <div className={styles.bulkBar + (bulkConfirming ? ` ${styles.bulkBarConfirm}` : '')}>
    {!bulkConfirming ? (
      <>
        <span className={styles.bulkCount}>
          <span className={styles.bulkCountPill}>
            <TbCheck size={9} />
            <span>{selectedIds.size}</span>
          </span>
          <span className={styles.bulkCountLabel}>
            {selectedIds.size === 1 ? 'entity' : 'entities'} selected
          </span>
        </span>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Set lifecycle</span>
          <Select.Root
            value={bulkLifecycleValue}
            placeholder="No Change"
            onChange={v => setBulkLifecycleValue(v ?? '')}
          >
            {lifecycleStates.map(s => (
              <Select.Item key={s.id} value={s.id}>
                {s.label}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div className={styles.bulkSep} />

        <label className={styles.bulkField}>
          <span className={styles.bulkFieldLabel}>Reassign owner</span>
          <Select.Root
            value={bulkOwnerValue}
            placeholder="No Change"
            onChange={v => setBulkOwnerValue(v ?? '')}
          >
            {teams.map(t => (
              <Select.Item key={t.id} value={t.id}>
                {t.name}
              </Select.Item>
            ))}
          </Select.Root>
        </label>

        <div style={{ flex: 1 }} />

        {(bulkLifecycleValue || bulkOwnerValue) && (
          <Button size="sm" variant="primary" onClick={() => setBulkConfirming(true)}>
            Review changes
          </Button>
        )}

        <Button size="sm" variant="secondary" onClick={onClear}>
          <TbX size={11} />
          <span>Clear</span>
        </Button>
      </>
    ) : (
      <>
        <div className={styles.bulkConfirmMsg}>
          <span className={styles.bulkWarnIcon}>!</span>
          <span>
            {bulkLifecycleValue && (
              <>
                <span className={styles.bulkDim}>Set lifecycle →</span>{' '}
                <b>
                  {lifecycleStates.find(s => s.id === bulkLifecycleValue)?.label ??
                    bulkLifecycleValue}
                </b>
              </>
            )}
            {bulkLifecycleValue && bulkOwnerValue && <span className={styles.bulkDim}> · </span>}
            {bulkOwnerValue && (
              <>
                <span className={styles.bulkDim}>Reassign owner →</span> <b>{bulkOwnerValue}</b>
              </>
            )}
            <span className={styles.bulkDim}> for </span>
            <b>{selectedIds.size}</b>
            <span className={styles.bulkDim}>
              {' '}
              {selectedIds.size === 1 ? 'entity' : 'entities'}
            </span>
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Button size="sm" variant="primary" onClick={onConfirm}>
          Confirm
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkConfirming(false)}>
          Cancel
        </Button>
      </>
    )}
  </div>
);
