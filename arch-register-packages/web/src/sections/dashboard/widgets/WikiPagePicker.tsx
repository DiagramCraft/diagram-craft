import { useMemo } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { useContentTree, type ContentScope } from '../../../hooks/useContentScope';
import type { WidgetSurface } from '../dashboardWidgetDefaults';
import styles from '../WidgetConfigDialog.module.css';

type Props = {
  workspaceSlug: string;
  projectId?: string;
  surface: WidgetSurface;
  value: string;
  onChange: (nodeId: string) => void;
};

const pageLabel = (file: ProjectFile, folder?: string) =>
  folder ? `${folder}/${file.name}` : file.name;

export const WikiPagePicker = ({ workspaceSlug, projectId, surface, value, onChange }: Props) => {
  const scope: ContentScope =
    surface === 'project'
      ? { kind: 'project', workspaceId: workspaceSlug, projectId: projectId ?? '' }
      : { kind: 'workspace', workspaceId: workspaceSlug };
  const { data, isLoading, isError } = useContentTree(scope);
  const hasProjectScope = surface !== 'project' || !!projectId;

  const pages = useMemo(() => {
    if (!data) return [];
    return [
      ...data.rootFiles.map(file => ({ file, label: pageLabel(file) })),
      ...data.folders.flatMap(folder =>
        folder.files.map(file => ({ file, label: pageLabel(file, folder.path) }))
      )
    ]
      .filter(({ file }) => file.type === 'markdown')
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [data]);

  return (
    <select
      className={styles.selectInput}
      value={value}
      onChange={event => onChange(event.target.value)}
      disabled={isLoading || isError || !hasProjectScope}
    >
      <option value="">
        {!hasProjectScope
          ? 'Project unavailable'
          : isLoading
            ? 'Loading wiki pages…'
            : isError
              ? 'Unable to load wiki pages'
              : 'Select a wiki page…'}
      </option>
      {pages.map(({ file, label }) => (
        <option key={file.id} value={file.id}>
          {label}
        </option>
      ))}
    </select>
  );
};
