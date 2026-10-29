import { TbBriefcase2, TbCalendarOff, TbCalendarWeek, TbFlag, TbGitCommit } from 'react-icons/tb';
import styles from './TimelineView.module.css';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { Button } from '@diagram-craft/app-components/Button';
import type { FieldOption } from './entityFieldSources';
import type { TimelineConfig } from './timelineViewTypes';

// ── Config bar ────────────────────────────────────────────────────────────────

export const TimelineConfigBar = ({
  cfg,
  onChange,
  dateFields,
  isEventMode
}: {
  cfg: TimelineConfig;
  onChange: (update: Partial<TimelineConfig>) => void;
  dateFields: FieldOption[];
  isEventMode: boolean;
}) => (
  <div className={styles.configBar}>
    <span className={styles.configMeta}>Date</span>

    <LabeledSelect
      label="Start"
      value={cfg.startFieldId ?? ''}
      onChange={v => onChange({ startFieldId: v ?? null })}
      options={[
        { value: '', label: '— none —' },
        ...dateFields.map(f => ({ value: f.id, label: f.label }))
      ]}
    />

    <span className={styles.configArrow}>→</span>

    <LabeledSelect
      label="End"
      value={cfg.endFieldId ?? ''}
      onChange={v => onChange({ endFieldId: v ?? null })}
      options={[
        { value: '', label: '— none —' },
        ...dateFields.map(f => ({ value: f.id, label: f.label }))
      ]}
    />

    <Button
      size="sm"
      variant={cfg.includeUndated ? 'primary' : 'secondary'}
      icon={<TbCalendarOff size={13} />}
      title={cfg.includeUndated ? 'Hide entities without dates' : 'Show entities without dates'}
      aria-label={
        cfg.includeUndated ? 'Hide entities without dates' : 'Show entities without dates'
      }
      aria-pressed={cfg.includeUndated}
      onClick={() => onChange({ includeUndated: !cfg.includeUndated })}
    />

    <div className={styles.configSep} />

    <LabeledSelect
      label="Group"
      value={cfg.groupBy}
      onChange={v => onChange({ groupBy: v as TimelineConfig['groupBy'] })}
      options={[
        { value: 'owner', label: 'By owner' },
        { value: 'type', label: 'By type' },
        { value: 'containment', label: 'By parent' },
        { value: 'project', label: 'Project, Entity' },
        { value: 'snapshot', label: 'Entity, Project' },
        { value: 'capability', label: 'Parent, Entity, Project' }
      ]}
    />

    <div className={styles.configSep} />

    <div className={styles.segmented}>
      {(['month', 'quarter', 'year'] as const).map(z => (
        <button
          key={z}
          type="button"
          className={cfg.zoom === z ? styles.segmentedActive : ''}
          onClick={() => onChange({ zoom: z })}
          title={z.charAt(0).toUpperCase() + z.slice(1)}
        >
          {z === 'month' ? 'Mo' : z === 'quarter' ? 'Qr' : 'Yr'}
        </button>
      ))}
    </div>

    {isEventMode && (
      <>
        <div className={styles.configSep} />
        {(cfg.groupBy === 'snapshot' || cfg.groupBy === 'capability') && (
          <Button
            size="sm"
            variant={cfg.showProjectLanes ? 'primary' : 'secondary'}
            icon={<TbBriefcase2 size={13} />}
            title={cfg.showProjectLanes ? 'Hide project lanes' : 'Show project lanes'}
            aria-label={cfg.showProjectLanes ? 'Hide project lanes' : 'Show project lanes'}
            aria-pressed={cfg.showProjectLanes}
            onClick={() => onChange({ showProjectLanes: !cfg.showProjectLanes })}
          />
        )}
        <Button
          size="sm"
          variant={cfg.showMilestones ? 'primary' : 'secondary'}
          icon={<TbFlag size={13} />}
          title={cfg.showMilestones ? 'Hide milestones' : 'Show milestones'}
          aria-label={cfg.showMilestones ? 'Hide milestones' : 'Show milestones'}
          aria-pressed={cfg.showMilestones}
          onClick={() => onChange({ showMilestones: !cfg.showMilestones })}
        />
        <Button
          size="sm"
          variant={cfg.showAutosaves ? 'primary' : 'secondary'}
          icon={<TbGitCommit size={13} />}
          title={cfg.showAutosaves ? 'Hide autosave snapshots' : 'Show autosave snapshots'}
          aria-label={cfg.showAutosaves ? 'Hide autosave snapshots' : 'Show autosave snapshots'}
          aria-pressed={cfg.showAutosaves}
          onClick={() => onChange({ showAutosaves: !cfg.showAutosaves })}
        />
      </>
    )}

    <div className={styles.configSep} />
    <Button
      size="sm"
      variant={cfg.showHorizonBands ? 'primary' : 'secondary'}
      icon={<TbCalendarWeek size={13} />}
      title={cfg.showHorizonBands ? 'Hide horizon bands' : 'Show horizon bands'}
      aria-label={cfg.showHorizonBands ? 'Hide horizon bands' : 'Show horizon bands'}
      aria-pressed={cfg.showHorizonBands}
      onClick={() => onChange({ showHorizonBands: !cfg.showHorizonBands })}
    />
  </div>
);
