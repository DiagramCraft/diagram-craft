import { useMemo, useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { useBaselines, useCreateBaseline } from '../../hooks/useBaselines';
import { useSavedViews } from '../../hooks/useSavedViews';
import type { CreateBaselineRequest } from '@arch-register/api-types/baselineContract';
import { ApiError } from '../../lib/http';
import styles from './BaselineScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/baselines');

const localDateTime = () => {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const formatDate = (value: string) => new Date(value).toLocaleString();
type BaselineScopeKind = CreateBaselineRequest['scope']['kind'];

export const BaselineListScreen = () => {
  const { workspaceSlug } = routeApi.useParams();
  const navigate = useNavigate();
  const { teams, projects } = useWorkspaceContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, { includeWorkspace: true });
  const { data: baselines = [], isLoading, error } = useBaselines(workspaceSlug);
  const createBaseline = useCreateBaseline(workspaceSlug);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [effectiveAt, setEffectiveAt] = useState(localDateTime);
  const [ownerTeamId, setOwnerTeamId] = useState('');
  const [scopeKind, setScopeKind] = useState<BaselineScopeKind>('workspace');
  const [scopeProjectId, setScopeProjectId] = useState('');
  const [scopeProjectScope, setScopeProjectScope] = useState<'project' | 'all'>('project');
  const [scopeViewId, setScopeViewId] = useState('');
  const [scopeEntityIds, setScopeEntityIds] = useState('');
  const [includePlannedChanges, setIncludePlannedChanges] = useState(true);
  const [includeOverdueChanges, setIncludeOverdueChanges] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);

  const createError = createBaseline.error instanceof ApiError
    ? createBaseline.error.message
    : createBaseline.error
      ? 'Could not create baseline'
      : null;
  const loadError = error instanceof ApiError ? error.message : error ? 'Could not load baselines' : null;
  const orderedTeams = useMemo(() => [...teams].sort((a, b) => a.name.localeCompare(b.name)), [teams]);
  const orderedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const orderedSavedViews = useMemo(
    () => [...savedViews].sort((a, b) => a.name.localeCompare(b.name)),
    [savedViews]
  );

  const resolveScope = (): CreateBaselineRequest['scope'] | null => {
    if (scopeKind === 'workspace') return { kind: 'workspace' };
    if (scopeKind === 'project') {
      return scopeProjectId
        ? { kind: 'project', projectId: scopeProjectId, projectScope: scopeProjectScope }
        : null;
    }
    if (scopeKind === 'saved_view') {
      return scopeViewId ? { kind: 'saved_view', viewId: scopeViewId } : null;
    }
    const entityIds = scopeEntityIds.split(/[\s,]+/).filter(id => id.length > 0);
    return entityIds.length > 0 && entityIds.length <= 1000 ? { kind: 'selection', entityIds } : null;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    const scope = resolveScope();
    if (scope == null) {
      setScopeError(
        scopeKind === 'selection'
          ? 'Enter one to 1,000 entity IDs for the selection.'
          : 'Choose a scope target before creating the baseline.'
      );
      return;
    }
    setScopeError(null);
    const trimmedDescription = description.trim();
    const created = await createBaseline.mutateAsync({
      name: name.trim(),
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      ownerTeamId: ownerTeamId.length > 0 ? ownerTeamId : null,
      effectiveAt: new Date(effectiveAt).toISOString(),
      scope,
      includePlannedChanges,
      includeOverdueChanges
    });
    setName('');
    setDescription('');
    navigate({
      to: '/$workspaceSlug/baselines/$baselineId',
      params: { workspaceSlug, baselineId: created.id }
    });
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Architecture baselines</h1>
          <p className={styles.subtitle}>Named, immutable catalog snapshots for governance and comparison.</p>
        </div>
      </header>

      <section className={styles.panel}>
        <div>
          <h2 className={styles.title}>Create workspace baseline</h2>
          <p className={styles.subtitle}>Capture the visible workspace catalog at a selected point in time.</p>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.field}>
            Name
            <input value={name} onChange={event => setName(event.target.value)} required maxLength={200} />
          </label>
          <label className={`${styles.field} ${styles.description}`}>
            Description
            <textarea value={description} onChange={event => setDescription(event.target.value)} rows={1} maxLength={2000} />
          </label>
          <label className={styles.field}>
            Effective date
            <input type="datetime-local" value={effectiveAt} onChange={event => setEffectiveAt(event.target.value)} required />
          </label>
          <label className={styles.field}>
            Owner team
            <select value={ownerTeamId} onChange={event => setOwnerTeamId(event.target.value)}>
              <option value="">No owner team</option>
              {orderedTeams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>
            Snapshot scope
            <select value={scopeKind} onChange={event => {
              setScopeKind(event.target.value as BaselineScopeKind);
              setScopeError(null);
            }}>
              <option value="workspace">Workspace</option>
              <option value="project">Project</option>
              <option value="saved_view">Saved view</option>
              <option value="selection">Entity selection</option>
            </select>
          </label>
          {scopeKind === 'project' && <label className={styles.field}>
            Project
            <select value={scopeProjectId} onChange={event => setScopeProjectId(event.target.value)}>
              <option value="">Choose a project</option>
              {orderedProjects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
          </label>}
          {scopeKind === 'project' && <label className={styles.field}>
            Project contents
            <select value={scopeProjectScope} onChange={event => setScopeProjectScope(event.target.value as 'project' | 'all')}>
              <option value="project">Project entities and links</option>
              <option value="all">Workspace entities plus project</option>
            </select>
          </label>}
          {scopeKind === 'saved_view' && <label className={styles.field}>
            Saved view
            <select value={scopeViewId} onChange={event => setScopeViewId(event.target.value)}>
              <option value="">Choose a saved view</option>
              {orderedSavedViews.map(view => <option key={view.id} value={view.id}>{view.name}</option>)}
            </select>
          </label>}
          {scopeKind === 'selection' && <label className={`${styles.field} ${styles.description}`}>
            Entity IDs
            <textarea value={scopeEntityIds} onChange={event => setScopeEntityIds(event.target.value)} rows={1} placeholder="One ID per line or separated by commas" />
          </label>}
          <label className={styles.checkbox}>
            <input type="checkbox" checked={includePlannedChanges} onChange={event => setIncludePlannedChanges(event.target.checked)} />
            Include planned changes
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={includeOverdueChanges} onChange={event => setIncludeOverdueChanges(event.target.checked)} />
            Include overdue changes
          </label>
          <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={createBaseline.isPending || !name.trim()}>
            {createBaseline.isPending ? 'Capturing…' : 'Create baseline'}
          </button>
        </form>
        {scopeError && <div className={styles.error}>{scopeError}</div>}
        {createError && <div className={styles.error}>{createError}</div>}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.title}>Saved baselines</h2>
        {loadError && <div className={styles.error}>{loadError}</div>}
        {isLoading ? <p className={styles.subtitle}>Loading baselines…</p> : baselines.length === 0 ? (
          <p className={styles.subtitle}>No baselines have been captured yet.</p>
        ) : (
          <table className={styles.table}>
            <thead><tr><th>Name</th><th>Status</th><th>Effective date</th><th>Scope</th><th>Records</th></tr></thead>
            <tbody>
              {baselines.map(baseline => (
                <tr key={baseline.id}>
                  <td><button type="button" className={styles.link} onClick={() => navigate({ to: '/$workspaceSlug/baselines/$baselineId', params: { workspaceSlug, baselineId: baseline.id } })}>{baseline.name}</button></td>
                  <td><span className={styles.status}>{baseline.status}</span></td>
                  <td>{formatDate(baseline.effectiveAt)}</td>
                  <td>{baseline.scope.source.kind.replace('_', ' ')}</td>
                  <td>{baseline.entityCount} entities · {baseline.relationCount} relations</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
};
