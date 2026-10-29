import { useNavigate, useSearch } from '@tanstack/react-router';
import { TbInbox, TbSend } from 'react-icons/tb';
import styles from '../../shell/SidePanel.module.css';
import { TreeRow } from '../../components/TreeRow';
import { SidebarTitleHeader } from '../../components/sidebar/SidebarPrimitives';
import { useGovernanceSubmissions, useGovernanceTaskCount } from '../../hooks/useGovernance';

const SCOPES = [
  { value: 'assigned', label: 'Assigned to me', icon: <TbInbox size={12} /> },
  { value: 'submitted', label: 'Requested by me', icon: <TbSend size={12} /> }
] as const;

export const GovernanceSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const { scope = 'assigned' } = useSearch({ strict: false }) as {
    scope?: 'assigned' | 'submitted';
  };

  // Open tasks, same count as the rail badge; submissions needing attention mirror the screen's
  // default "Needs attention" filter (the unfiltered submissions query is shared via the cache)
  const { data: taskCount } = useGovernanceTaskCount(workspaceSlug);
  const { data: submissions } = useGovernanceSubmissions(workspaceSlug);
  const counts = {
    assigned: taskCount?.count,
    submitted: submissions?.filter(
      submission =>
        submission.case.status === 'open' || submission.case.outcome === 'request_changes'
    ).length
  };

  return (
    <>
      <SidebarTitleHeader title="My work" />
      <div className={styles.scroll}>
        {SCOPES.map(s => (
          <TreeRow
            key={s.value}
            testId={`my-work-scope-${s.value}`}
            icon={s.icon}
            label={s.label}
            active={scope === s.value}
            trailing={
              counts[s.value] ? <span className="dim mono">{counts[s.value]}</span> : undefined
            }
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/governance',
                params: { workspaceSlug },
                search: { scope: s.value === 'assigned' ? undefined : s.value }
              })
            }
          />
        ))}
      </div>
    </>
  );
};
