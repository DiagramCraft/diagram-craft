import { useState } from 'react';
import { getRouteApi, useNavigate } from '@tanstack/react-router';
import type { BaselineLinkTargetType } from '@arch-register/api-types/baselineContract';
import {
  useBaseline,
  useBaselineDiff,
  useBaselines,
  useCreateBaselineLink,
  useDeleteBaseline,
  useDeleteBaselineLink,
  useSupersedeBaseline
} from '../../hooks/useBaselines';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { downloadBlob } from '../../lib/browserDownload';
import { ApiError } from '../../lib/http';
import styles from './BaselineScreen.module.css';

const routeApi = getRouteApi('/authenticated/$workspaceSlug/baselines/$baselineId');
const formatDate = (value: string) => new Date(value).toLocaleString();

export const BaselineDetailScreen = () => {
  const { workspaceSlug, baselineId } = routeApi.useParams();
  const navigate = useNavigate();
  const { projects } = useWorkspaceContext();
  const { data: baseline, isLoading, error } = useBaseline(workspaceSlug, baselineId);
  const { data: baselines = [] } = useBaselines(workspaceSlug);
  const diff = useBaselineDiff(workspaceSlug);
  const deleteBaseline = useDeleteBaseline(workspaceSlug);
  const supersede = useSupersedeBaseline(workspaceSlug);
  const createLink = useCreateBaselineLink(workspaceSlug, baselineId);
  const deleteLink = useDeleteBaselineLink(workspaceSlug, baselineId);
  const [compareId, setCompareId] = useState('');
  const [targetType, setTargetType] = useState<BaselineLinkTargetType>('project');
  const [targetId, setTargetId] = useState('');
  const [comparison, setComparison] = useState<Awaited<ReturnType<typeof diff.mutateAsync>> | null>(null);

  if (isLoading) return <main className={styles.screen}><p className={styles.subtitle}>Loading baseline…</p></main>;
  if (!baseline) return <main className={styles.screen}><p className={styles.error}>{error instanceof ApiError ? error.message : 'Baseline not found'}</p></main>;

  const actionError = [diff.error, deleteBaseline.error, supersede.error, createLink.error, deleteLink.error].find(Boolean);
  const download = () => {
    const filename = baseline.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadBlob(
      new Blob([JSON.stringify(baseline, null, 2)], { type: 'application/json' }),
      `${filename.length > 0 ? filename : 'baseline'}.json`
    );
  };
  const compare = async () => {
    setComparison(await diff.mutateAsync({
      from: { kind: 'baseline', id: baseline.id },
      to: compareId ? { kind: 'baseline', id: compareId } : { kind: 'current' }
    }));
  };
  const remove = async () => {
    if (!window.confirm(`Delete baseline “${baseline.name}”? Historical evidence will be retained.`)) return;
    await deleteBaseline.mutateAsync(baseline.id);
    navigate({ to: '/$workspaceSlug/baselines', params: { workspaceSlug } });
  };
  const markSuperseded = async () => {
    if (!compareId) return;
    await supersede.mutateAsync({ id: baseline.id, replacementId: compareId });
  };
  const addReference = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedId = targetId.trim();
    if (trimmedId.length === 0) return;
    await createLink.mutateAsync({ targetType, targetId: trimmedId });
    setTargetId('');
  };

  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>{baseline.name}</h1>
          <p className={styles.subtitle}>{baseline.description ?? 'Read-only architecture baseline'}</p>
        </div>
        <div className={styles.toolbar}>
          <button type="button" className={styles.button} onClick={download}>Export JSON</button>
          <button type="button" className={`${styles.button} ${styles.danger}`} onClick={remove} disabled={deleteBaseline.isPending}>Soft-delete</button>
        </div>
      </header>

      <section className={styles.panel}>
        <dl className={styles.metadata}>
          <div><dt>Status</dt><dd><span className={styles.status}>{baseline.status}</span></dd></div>
          <div><dt>Effective date</dt><dd>{formatDate(baseline.effectiveAt)}</dd></div>
          <div><dt>Scope</dt><dd>{baseline.scope.source.kind.replace('_', ' ')}</dd></div>
          <div><dt>Records</dt><dd>{baseline.entityCount} entities · {baseline.relationCount} relations</dd></div>
        </dl>
        <div className={styles.toolbar}>
          <select value={compareId} onChange={event => setCompareId(event.target.value)}>
            <option value="">Compare with current state</option>
            {baselines.filter(candidate => candidate.id !== baseline.id).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
          </select>
          <button type="button" className={`${styles.button} ${styles.primary}`} onClick={compare} disabled={diff.isPending}>{diff.isPending ? 'Comparing…' : 'Compare'}</button>
          {compareId && <button type="button" className={styles.button} onClick={markSuperseded} disabled={supersede.isPending}>{supersede.isPending ? 'Updating…' : 'Mark superseded'}</button>}
        </div>
        {actionError && <div className={styles.error}>{actionError instanceof ApiError ? actionError.message : 'Could not complete baseline action'}</div>}
      </section>

      {comparison && <section className={styles.panel}>
        <h2 className={styles.title}>Comparison</h2>
        <p className={styles.counts}>{comparison.added.length} added · {comparison.removed.length} removed · {comparison.changed.length} changed entities · {comparison.relations.added.length + comparison.relations.removed.length + comparison.relations.changed.length} relation changes</p>
        {(comparison.added.length > 0 || comparison.removed.length > 0 || comparison.changed.length > 0) && <table className={styles.table}>
          <thead><tr><th>Entity</th><th>Change</th></tr></thead>
          <tbody>
            {comparison.added.map(entity => <tr key={`added-${entity._uid}`}><td>{entity._name}</td><td>Added</td></tr>)}
            {comparison.removed.map(entity => <tr key={`removed-${entity._uid}`}><td>{entity._name}</td><td>Removed</td></tr>)}
            {comparison.changed.map(entry => {
              const changedFields = Object.keys(entry.diff).join(', ');
              return <tr key={`changed-${entry.entity._uid}`}><td>{entry.entity._name}</td><td>{changedFields.length > 0 ? changedFields : 'Restricted changes'}</td></tr>;
            })}
          </tbody>
        </table>}
      </section>}

      <section className={styles.panel}>
        <h2 className={styles.title}>Captured entities</h2>
        {baseline.entities.length === 0 ? <p className={styles.subtitle}>No entities were captured.</p> : <table className={styles.table}>
          <thead><tr><th>Name</th><th>Schema</th><th>Owner</th><th>Lifecycle</th></tr></thead>
          <tbody>{baseline.entities.map(entity => <tr key={entity._uid}><td>{entity._name}</td><td>{entity._schema.name}</td><td>{entity._owner?.name ?? '—'}</td><td>{entity._lifecycle?.name ?? '—'}</td></tr>)}</tbody>
        </table>}
      </section>

      <section className={styles.panel}>
        <h2 className={styles.title}>Captured relations</h2>
        {baseline.relations.length === 0 ? <p className={styles.subtitle}>No relations were captured.</p> : <table className={styles.table}>
          <thead><tr><th>From</th><th>Relation</th><th>To</th></tr></thead>
          <tbody>{baseline.relations.map(relation => <tr key={relation._uid}><td>{relation._in.name}</td><td>{relation._schema.name}</td><td>{relation._out.name}</td></tr>)}</tbody>
        </table>}
      </section>

      <section className={styles.panel}>
        <div>
          <h2 className={styles.title}>References</h2>
          <p className={styles.subtitle}>Connect this immutable snapshot to the project, change, document, milestone, or governance case that explains it.</p>
        </div>
        <form className={styles.toolbar} onSubmit={addReference}>
          <select value={targetType} onChange={event => setTargetType(event.target.value as BaselineLinkTargetType)}>
            <option value="project">Project</option>
            <option value="milestone">Milestone</option>
            <option value="planned_change">Planned change</option>
            <option value="document">Document</option>
            <option value="governance_case">Governance case</option>
          </select>
          <input
            value={targetId}
            onChange={event => setTargetId(event.target.value)}
            list={targetType === 'project' ? 'baseline-projects' : undefined}
            placeholder={targetType === 'project' ? 'Project ID' : 'Target ID'}
            aria-label="Reference target ID"
          />
          {targetType === 'project' && <datalist id="baseline-projects">
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </datalist>}
          <button className={`${styles.button} ${styles.primary}`} type="submit" disabled={createLink.isPending || targetId.trim().length === 0}>
            {createLink.isPending ? 'Adding…' : 'Add reference'}
          </button>
        </form>
        {baseline.links.length === 0 ? <p className={styles.subtitle}>No references have been added.</p> : <table className={styles.table}>
          <thead><tr><th>Type</th><th>Target</th><th>Added</th><th /></tr></thead>
          <tbody>{baseline.links.map(link => <tr key={link.id}>
            <td>{link.targetType.replace('_', ' ')}</td>
            <td>{link.targetId}</td>
            <td>{formatDate(link.createdAt)}</td>
            <td><button type="button" className={styles.link} onClick={() => deleteLink.mutate(link.id)} disabled={deleteLink.isPending}>Remove</button></td>
          </tr>)}</tbody>
        </table>}
      </section>
    </main>
  );
};
