import { useEffect, useMemo, useState } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import type { MarkdownCloseImpactSummary } from './markdownDiagramSession';
import styles from './MarkdownCloseDialog.module.css';

const reasonText = {
  collaborative: 'Edited collaboratively while the diagram was open.',
  changed: 'Changed again after your diagram editing session ended.'
} as const;

export const MarkdownCloseDialog = ({
  open,
  summary,
  onCancel,
  onCloseWithSelection
}: {
  open: boolean;
  summary: MarkdownCloseImpactSummary | null;
  onCancel: () => void;
  onCloseWithSelection: (diagramIds: string[]) => void;
}) => {
  const hasCreatedDiagrams = (summary?.createdDiagramsToDelete.length ?? 0) > 0;
  const hasRevertableDiagrams = (summary?.revertableDiagrams.length ?? 0) > 0;
  const hasNonRevertableDiagrams = (summary?.nonRevertableDiagrams.length ?? 0) > 0;
  const hasDiagramEffects = hasCreatedDiagrams || hasRevertableDiagrams || hasNonRevertableDiagrams;
  const revertableIds = useMemo(
    () => summary?.revertableDiagrams.map(diagram => diagram.diagramId) ?? [],
    [summary]
  );
  const [selectedDiagramIds, setSelectedDiagramIds] = useState<string[]>(revertableIds);

  useEffect(() => {
    setSelectedDiagramIds(revertableIds);
  }, [revertableIds]);

  const toggleDiagram = (diagramId: string) => {
    setSelectedDiagramIds(current =>
      current.includes(diagramId)
        ? current.filter(currentId => currentId !== diagramId)
        : [...current, diagramId]
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Discard markdown changes?"
      width={520}
      footerLeft={<KbdHints hints={[['Esc', 'cancel']]} />}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: 'Close',
          type: 'default',
          onClick: () => onCloseWithSelection(hasDiagramEffects ? selectedDiagramIds : [])
        }
      ]}
    >
      <div className={styles.dialogBody}>
        <p className={styles.summary}>
          Your markdown edits will be discarded. Embedded diagram changes can be kept or reverted
          depending on how they were edited.
        </p>

        {hasCreatedDiagrams && summary && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>New embedded diagrams that will be removed</div>
            <ul className={styles.list}>
              {summary.createdDiagramsToDelete.map(diagram => (
                <li key={diagram.id} className={styles.listItem}>
                  <span>{diagram.name ?? diagram.id}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {hasDiagramEffects && summary && (
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Embedded diagrams</div>
            <div className={styles.sectionHelp}>
              Select which existing embedded diagrams to revert. Unselected diagrams will keep their
              current saved state.
            </div>
            <ul className={styles.checklist}>
              {summary.revertableDiagrams.map(diagram => (
                <li key={diagram.diagramId} className={styles.checklistItem}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={selectedDiagramIds.includes(diagram.diagramId)}
                      onChange={() => toggleDiagram(diagram.diagramId)}
                    />
                    <span className={styles.checkboxText}>
                      <span>{diagram.name}</span>
                      <span className={styles.reason}>Safe to revert.</span>
                    </span>
                  </label>
                </li>
              ))}
              {summary.nonRevertableDiagrams.map(diagram => (
                <li key={diagram.diagramId} className={styles.checklistItem}>
                  <label className={`${styles.checkboxRow} ${styles.checkboxRowDisabled}`}>
                    <input type="checkbox" checked={false} disabled />
                    <span className={styles.checkboxText}>
                      <span>{diagram.name}</span>
                      <span className={styles.reason}>
                        {diagram.reason ? reasonText[diagram.reason] : ''}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Dialog>
  );
};
