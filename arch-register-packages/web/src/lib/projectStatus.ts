import type { Project } from '@arch-register/api-types/projectCrudContract';

export type ProjectStatus = Project['status'];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{ value: ProjectStatus; label: string }> = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'complete', label: 'Complete' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const isArchivedProject = (project: Pick<Project, 'status'> | undefined) =>
  project?.status === 'complete' || project?.status === 'cancelled';
